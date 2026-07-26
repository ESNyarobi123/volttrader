"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Copy,
  KeyRound,
  LifeBuoy,
  LogOut,
  ShieldCheck,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  updateProfileSchema,
  kycSubmissionSchema,
  supportTicketSchema,
  type UpdateProfileInput,
  type KycSubmissionInput,
  type SupportTicketInput,
} from "@volt/validation";
import type { SessionUser, TwoFactorSetupView } from "@volt/types";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate, initials } from "@/lib/format";
import { statusVariant, humanize } from "@/lib/status";
import { KycDocField } from "@/components/dashboard/kyc-doc-field";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { cn } from "@/lib/utils";

const kycFormSchema = kycSubmissionSchema.extend({
  backImageKey: z.string().max(200).optional(),
  selfieKey: z.string().max(200).optional(),
});
type KycFormValues = z.infer<typeof kycFormSchema>;

const profileFormSchema = updateProfileSchema.extend({
  phone: z.string().max(20).optional(),
  country: z.string().max(60).optional(),
});
type ProfileFormValues = z.infer<typeof profileFormSchema>;

interface KycSubmissionView {
  id: string;
  documentType: string;
  documentNumber: string;
  status: string;
  reviewerNote?: string | null;
  createdAt: string;
}

interface KycMeResponse {
  kycStatus: string;
  submission: KycSubmissionView | null;
}

interface CommunityMembership {
  status: string;
  joinedAt?: string;
}

const TABS = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "security", label: "Security", icon: KeyRound },
  { id: "kyc", label: "KYC", icon: ShieldCheck },
  { id: "support", label: "Support", icon: LifeBuoy },
  { id: "society", label: "Society", icon: Users },
] as const;

type TabId = (typeof TABS)[number]["id"];

function isTabId(value: string | null): value is TabId {
  return TABS.some((t) => t.id === value);
}

function shortKyc(status: string) {
  if (status === "NOT_STARTED") return "None";
  if (status === "PENDING") return "Pending";
  if (status === "APPROVED") return "OK";
  if (status === "REJECTED") return "Rejected";
  if (status === "NEEDS_MORE_INFO") return "More info";
  return humanize(status);
}

export default function DashboardProfilePage() {
  const { user, logout, refresh } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const tabParam = searchParams.get("tab");
  const initialTab: TabId = isTabId(tabParam) ? tabParam : "profile";
  const [tab, setTab] = useState<TabId>(initialTab);

  const [profileSuccess, setProfileSuccess] = useState(false);
  const [kycSuccess, setKycSuccess] = useState(false);
  const [supportSuccess, setSupportSuccess] = useState(false);
  const [communityError, setCommunityError] = useState<string | null>(null);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [twoFactorSetup, setTwoFactorSetup] = useState<TwoFactorSetupView | null>(null);
  const [enableCode, setEnableCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [securityFlash, setSecurityFlash] = useState<string | null>(null);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  useEffect(() => {
    if (isTabId(searchParams.get("tab"))) {
      setTab(searchParams.get("tab") as TabId);
    }
  }, [searchParams]);

  const onTabChange = (value: TabId) => {
    setTab(value);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.replace(`/dashboard/profile?${params.toString()}`, { scroll: false });
  };

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      fullName: user?.fullName ?? "",
      phone: user?.phone ?? "",
      country: "",
    },
  });

  useEffect(() => {
    if (!user) return;
    profileForm.reset({
      fullName: user.fullName ?? "",
      phone: user.phone ?? "",
      country: "",
    });
  }, [user, profileForm]);

  const updateProfile = useMutation({
    mutationFn: (values: UpdateProfileInput) => api.patch("/users/me", values),
    onSuccess: async () => {
      setProfileSuccess(true);
      await refresh();
    },
  });

  const resendVerification = useMutation({
    mutationFn: () => api.post<{ message: string }>("/auth/resend-verification"),
    onSuccess: (res) => setVerifyMessage(res.message),
    onError: (err) => {
      setVerifyMessage(
        apiErrorMessage(err, "Could not resend verification."),
      );
    },
  });

  const kycQuery = useQuery({
    queryKey: ["kyc", "me"],
    queryFn: () => api.get<KycMeResponse>("/kyc/me"),
  });

  const kycForm = useForm<KycFormValues>({
    resolver: zodResolver(kycFormSchema),
    defaultValues: {
      documentType: "NATIONAL_ID",
      documentNumber: "",
      frontImageKey: "",
      backImageKey: "",
      selfieKey: "",
    },
  });

  const submitKyc = useMutation({
    mutationFn: (values: KycSubmissionInput) => api.post("/kyc", values),
    onSuccess: async () => {
      setKycSuccess(true);
      kycForm.reset();
      await queryClient.invalidateQueries({ queryKey: ["kyc", "me"] });
      await refresh();
    },
  });

  const supportForm = useForm<SupportTicketInput>({
    resolver: zodResolver(supportTicketSchema),
    defaultValues: { subject: "", message: "", category: "GENERAL" },
  });

  const submitTicket = useMutation({
    mutationFn: (values: SupportTicketInput) => api.post("/support/tickets", values),
    onSuccess: () => {
      setSupportSuccess(true);
      supportForm.reset({ subject: "", message: "", category: "GENERAL" });
    },
  });

  const communityQuery = useQuery({
    queryKey: ["community", "me"],
    queryFn: () => api.get<CommunityMembership | null>("/community/me"),
    retry: false,
  });

  const joinCommunity = useMutation({
    mutationFn: () => api.post("/community/join", {}),
    onSuccess: async () => {
      setCommunityError(null);
      await queryClient.invalidateQueries({ queryKey: ["community", "me"] });
    },
    onError: (err) => {
      setCommunityError(
        apiErrorMessage(err, "Could not join Volt Society"),
      );
    },
  });

  const setup2fa = useMutation({
    mutationFn: () => api.post<TwoFactorSetupView>("/auth/2fa/setup"),
    onSuccess: (data) => {
      setSecurityError(null);
      setTwoFactorSetup(data);
      setSecurityFlash("Enter the secret in your app, then confirm.");
    },
    onError: (err) => {
      setSecurityError(apiErrorMessage(err, "Could not start 2FA"));
    },
  });

  const enable2fa = useMutation({
    mutationFn: () => api.post<SessionUser>("/auth/2fa/enable", { code: enableCode }),
    onSuccess: async () => {
      setSecurityError(null);
      setTwoFactorSetup(null);
      setEnableCode("");
      setSecurityFlash("2FA enabled.");
      await refresh();
    },
    onError: (err) => {
      setSecurityError(apiErrorMessage(err, "Invalid code"));
    },
  });

  const disable2fa = useMutation({
    mutationFn: () =>
      api.post<SessionUser>("/auth/2fa/disable", {
        code: disableCode,
        password: disablePassword,
      }),
    onSuccess: async () => {
      setSecurityError(null);
      setDisableCode("");
      setDisablePassword("");
      setSecurityFlash("2FA disabled.");
      await refresh();
    },
    onError: (err) => {
      setSecurityError(apiErrorMessage(err, "Could not disable 2FA"));
    },
  });

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  const kycStatus = kycQuery.data?.kycStatus ?? user?.kycStatus ?? "NOT_STARTED";
  const kycApproved = kycStatus === "APPROVED";
  const societyStatus = communityQuery.data?.status;
  const loading = !user || kycQuery.isLoading;

  return (
    <div className="w-full space-y-5 sm:space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">Profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your account.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="justify-center rounded-full sm:shrink-0"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Log out
        </Button>
      </header>

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
              icon={ShieldCheck}
              label="KYC"
              value={shortKyc(kycStatus)}
            />
            <Stat
              accent="ink"
              icon={KeyRound}
              label="2FA"
              value={user?.twoFactorEnabled ? "On" : "Off"}
            />
            <Stat
              accent="soft"
              icon={Users}
              label="Society"
              value={societyStatus ? humanize(societyStatus) : "None"}
            />
          </>
        )}
      </section>

      {/* Focus */}
      {loading ? (
        <Skeleton className="h-32 w-full rounded-2xl" />
      ) : (
        <section className="flex flex-col gap-4 rounded-2xl border border-volt/25 bg-gradient-to-br from-volt/12 via-surface to-surface p-4 shadow-card sm:flex-row sm:items-center sm:gap-5 sm:p-5">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-ink/90 font-display text-lg font-bold text-white shadow-sm">
            {initials(user?.fullName)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-volt-dim">
                Member
              </p>
              <Badge variant={statusVariant(kycStatus)} className="text-[10px]">
                KYC · {humanize(kycStatus)}
              </Badge>
              <Badge variant={user?.twoFactorEnabled ? "success" : "warning"} className="text-[10px]">
                2FA {user?.twoFactorEnabled ? "on" : "off"}
              </Badge>
            </div>
            <h2 className="mt-1 truncate font-display text-lg font-bold tracking-tight">
              {user?.fullName ?? "—"}
            </h2>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {user?.email ?? user?.phone ?? "—"}
              {user?.createdAt ? ` · since ${formatDate(user.createdAt)}` : ""}
            </p>
          </div>
          {!user?.emailVerified && user?.email ? (
            <Button
              variant="outline"
              size="md"
              className="w-full shrink-0 rounded-full sm:w-auto"
              disabled={resendVerification.isPending}
              onClick={() => resendVerification.mutate()}
            >
              {resendVerification.isPending ? "Sending…" : "Verify email"}
            </Button>
          ) : null}
        </section>
      )}

      {verifyMessage ? <Alert variant="volt">{verifyMessage}</Alert> : null}

      {/* Tabs — chip style like Invest filters */}
      <section className="space-y-3">
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                tab === item.id
                  ? "bg-volt text-volt-foreground"
                  : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
              )}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          ))}
        </div>

        {/* PROFILE */}
        {tab === "profile" ? (
          <Panel title="Details" icon={UserRound}>
            <form
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
              onSubmit={profileForm.handleSubmit((values) => {
                setProfileSuccess(false);
                updateProfile.mutate({
                  ...values,
                  phone: values.phone ? values.phone : undefined,
                  country: values.country ? values.country : undefined,
                });
              })}
            >
              <Field
                label="Full name"
                htmlFor="fullName"
                error={profileForm.formState.errors.fullName?.message}
                className="sm:col-span-2"
              >
                <Input id="fullName" {...profileForm.register("fullName")} />
              </Field>
              <Field
                label="Phone"
                htmlFor="phone"
                error={profileForm.formState.errors.phone?.message}
              >
                <Input
                  id="phone"
                  placeholder="+255700000000"
                  {...profileForm.register("phone")}
                />
              </Field>
              <Field label="Country" htmlFor="country">
                <Input id="country" placeholder="Tanzania" {...profileForm.register("country")} />
              </Field>
              <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                <Button
                  type="submit"
                  variant="primary"
                  className="rounded-full"
                  disabled={updateProfile.isPending}
                >
                  {updateProfile.isPending ? "Saving…" : "Save"}
                </Button>
                {profileSuccess ? (
                  <span className="inline-flex items-center gap-1 text-sm text-success">
                    <BadgeCheck className="h-4 w-4" />
                    Saved
                  </span>
                ) : null}
              </div>
              {updateProfile.error ? (
                <Alert variant="danger" className="sm:col-span-2">
                  {apiErrorMessage(updateProfile.error, "Could not save")}
                </Alert>
              ) : null}
            </form>
          </Panel>
        ) : null}

        {/* SECURITY */}
        {tab === "security" ? (
          <Panel
            title="2FA"
            icon={KeyRound}
            action={
              <Badge variant={user?.twoFactorEnabled ? "success" : "warning"}>
                {user?.twoFactorEnabled ? "On" : "Off"}
              </Badge>
            }
          >
            <p className="mb-3 text-sm text-muted-foreground">Required for withdrawals.</p>
            {securityFlash ? <Alert variant="volt">{securityFlash}</Alert> : null}
            {securityError ? <Alert variant="danger">{securityError}</Alert> : null}

            {user?.twoFactorEnabled ? (
              <div className="mt-3 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="disable-totp">Code</Label>
                    <Input
                      id="disable-totp"
                      inputMode="numeric"
                      maxLength={6}
                      className="font-mono tracking-[0.2em]"
                      value={disableCode}
                      onChange={(e) => setDisableCode(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="disable-password">Password</Label>
                    <Input
                      id="disable-password"
                      type="password"
                      value={disablePassword}
                      onChange={(e) => setDisablePassword(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  variant="danger"
                  className="rounded-full"
                  disabled={disable2fa.isPending || disableCode.length !== 6 || !disablePassword}
                  onClick={() => {
                    setSecurityFlash(null);
                    disable2fa.mutate();
                  }}
                >
                  {disable2fa.isPending ? "Disabling…" : "Disable 2FA"}
                </Button>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {!twoFactorSetup ? (
                  <Button
                    variant="primary"
                    className="rounded-full shadow-volt"
                    disabled={setup2fa.isPending}
                    onClick={() => {
                      setSecurityFlash(null);
                      setSecurityError(null);
                      setup2fa.mutate();
                    }}
                  >
                    {setup2fa.isPending ? "Preparing…" : "Set up 2FA"}
                  </Button>
                ) : (
                  <>
                    <div className="rounded-2xl border border-border bg-surface-2/40 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Secret
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <code className="break-all font-mono text-sm font-semibold">
                          {twoFactorSetup.secret}
                        </code>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          onClick={async () => {
                            await navigator.clipboard.writeText(twoFactorSetup.secret);
                            setCopiedSecret(true);
                            window.setTimeout(() => setCopiedSecret(false), 1500);
                          }}
                        >
                          {copiedSecret ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          Copy
                        </Button>
                      </div>
                      <a
                        href={twoFactorSetup.otpauthUrl}
                        className="mt-3 inline-block text-sm font-semibold text-volt-dim underline"
                      >
                        Open authenticator
                      </a>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="enable-totp">Confirm code</Label>
                      <Input
                        id="enable-totp"
                        inputMode="numeric"
                        maxLength={6}
                        className="font-mono tracking-[0.2em]"
                        value={enableCode}
                        onChange={(e) => setEnableCode(e.target.value)}
                      />
                    </div>
                    <Button
                      variant="primary"
                      className="rounded-full shadow-volt"
                      disabled={enable2fa.isPending || enableCode.length !== 6}
                      onClick={() => {
                        setSecurityFlash(null);
                        enable2fa.mutate();
                      }}
                    >
                      {enable2fa.isPending ? "Enabling…" : "Enable 2FA"}
                    </Button>
                  </>
                )}
              </div>
            )}
          </Panel>
        ) : null}

        {/* KYC */}
        {tab === "kyc" ? (
          <Panel
            title="Identity"
            icon={ShieldCheck}
            action={<Badge variant={statusVariant(kycStatus)}>{humanize(kycStatus)}</Badge>}
          >
            {kycQuery.isLoading ? (
              <Skeleton className="h-28 w-full rounded-xl" />
            ) : kycApproved ? (
              <div className="flex items-center gap-3 rounded-2xl border border-success/25 bg-success/10 p-4">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-success/15 text-success">
                  <BadgeCheck className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold">Verified</p>
                  <p className="text-sm text-muted-foreground">Ready for invest & withdraw.</p>
                </div>
              </div>
            ) : (
              <form
                className="flex flex-col gap-4"
                onSubmit={kycForm.handleSubmit((values) => {
                  setKycSuccess(false);
                  submitKyc.mutate({
                    ...values,
                    backImageKey: values.backImageKey?.trim()
                      ? values.backImageKey.trim()
                      : undefined,
                    selfieKey: values.selfieKey?.trim() ? values.selfieKey.trim() : undefined,
                  });
                })}
              >
                {kycQuery.data?.submission?.reviewerNote ? (
                  <p className="rounded-xl border border-border bg-surface-2/60 px-3 py-2.5 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Note: </span>
                    {kycQuery.data.submission.reviewerNote}
                  </p>
                ) : null}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Document" htmlFor="documentType">
                    <Select id="documentType" {...kycForm.register("documentType")}>
                      <option value="NATIONAL_ID">National ID</option>
                      <option value="PASSPORT">Passport</option>
                      <option value="DRIVER_LICENSE">Driver&apos;s license</option>
                    </Select>
                  </Field>
                  <Field
                    label="Number"
                    htmlFor="documentNumber"
                    error={kycForm.formState.errors.documentNumber?.message}
                  >
                    <Input id="documentNumber" {...kycForm.register("documentNumber")} />
                  </Field>
                </div>

                <div className="space-y-3 rounded-2xl border border-border bg-surface-2/20 p-3 sm:p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-volt-dim">
                    Documents
                  </p>
                  <KycDocField
                    label="Front"
                    required
                    value={kycForm.watch("frontImageKey") ?? ""}
                    onChange={(key) =>
                      kycForm.setValue("frontImageKey", key, { shouldValidate: true })
                    }
                    error={kycForm.formState.errors.frontImageKey?.message}
                    hint="Storage key from upload or paste"
                  />
                  <KycDocField
                    label="Back"
                    value={kycForm.watch("backImageKey") ?? ""}
                    onChange={(key) =>
                      kycForm.setValue("backImageKey", key, { shouldValidate: true })
                    }
                    hint="Optional"
                  />
                  <KycDocField
                    label="Selfie"
                    value={kycForm.watch("selfieKey") ?? ""}
                    onChange={(key) =>
                      kycForm.setValue("selfieKey", key, { shouldValidate: true })
                    }
                    hint="Optional"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="submit"
                    variant="primary"
                    className="rounded-full shadow-volt"
                    disabled={submitKyc.isPending}
                  >
                    {submitKyc.isPending ? "Submitting…" : "Submit for review"}
                  </Button>
                  {kycSuccess ? <span className="text-sm text-success">Submitted.</span> : null}
                </div>
                {submitKyc.error ? (
                  <Alert variant="danger">
                    {apiErrorMessage(submitKyc.error, "Could not submit")}
                  </Alert>
                ) : null}
                {kycQuery.data?.submission ? (
                  <p className="text-xs text-muted-foreground">
                    Last: {humanize(kycQuery.data.submission.documentType)} ·{" "}
                    {formatDate(kycQuery.data.submission.createdAt)}
                  </p>
                ) : null}
              </form>
            )}
          </Panel>
        ) : null}

        {/* SUPPORT */}
        {tab === "support" ? (
          <Panel title="Support" icon={LifeBuoy}>
            <form
              className="flex flex-col gap-3"
              onSubmit={supportForm.handleSubmit((values) => {
                setSupportSuccess(false);
                submitTicket.mutate(values);
              })}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                  label="Subject"
                  htmlFor="subject"
                  error={supportForm.formState.errors.subject?.message}
                >
                  <Input id="subject" {...supportForm.register("subject")} />
                </Field>
                <Field label="Category" htmlFor="category">
                  <Select id="category" {...supportForm.register("category")}>
                    <option value="GENERAL">General</option>
                    <option value="PAYMENTS">Payments</option>
                    <option value="COURSES">Courses</option>
                    <option value="INVESTMENTS">Investments</option>
                    <option value="KYC">KYC</option>
                  </Select>
                </Field>
              </div>
              <Field
                label="Message"
                htmlFor="message"
                error={supportForm.formState.errors.message?.message}
              >
                <Textarea id="message" rows={4} {...supportForm.register("message")} />
              </Field>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="submit"
                  variant="primary"
                  className="rounded-full shadow-volt"
                  disabled={submitTicket.isPending}
                >
                  {submitTicket.isPending ? "Sending…" : "Send"}
                </Button>
                {supportSuccess ? <span className="text-sm text-success">Sent.</span> : null}
              </div>
              {submitTicket.error ? (
                <Alert variant="danger">
                  {apiErrorMessage(submitTicket.error, "Could not send")}
                </Alert>
              ) : null}
            </form>
          </Panel>
        ) : null}

        {/* SOCIETY */}
        {tab === "society" ? (
          <Panel title="Society" icon={Users}>
            {communityQuery.isLoading ? (
              <Skeleton className="h-24 w-full rounded-xl" />
            ) : communityQuery.data ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-ink/90 text-white">
                  <Users className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <Badge variant={statusVariant(communityQuery.data.status)}>
                    {humanize(communityQuery.data.status)}
                  </Badge>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {communityQuery.data.joinedAt
                      ? `Since ${formatDate(communityQuery.data.joinedAt)}`
                      : "Membership recorded."}
                  </p>
                </div>
                <Link
                  href="/dashboard/society"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "rounded-full",
                  )}
                >
                  Open
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <p className="flex-1 text-sm text-muted-foreground">Join the waitlist.</p>
                <Button
                  variant="primary"
                  size="sm"
                  className="rounded-full shadow-volt"
                  onClick={() => joinCommunity.mutate()}
                  disabled={joinCommunity.isPending}
                >
                  {joinCommunity.isPending ? "Joining…" : "Join"}
                </Button>
              </div>
            )}
            {communityError ? (
              <Alert variant="danger" className="mt-3">
                {communityError}
              </Alert>
            ) : null}
          </Panel>
        ) : null}
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
  icon: LucideIcon;
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

function Panel({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-volt/12 text-volt-dim">
            <Icon className="h-4 w-4" />
          </span>
          <h2 className="font-display text-lg font-bold tracking-tight">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

