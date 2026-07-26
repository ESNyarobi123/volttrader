"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LogOut,
  ShieldCheck,
  LifeBuoy,
  Users,
  UserRound,
  Mail,
  Calendar,
  BadgeCheck,
  Sparkles,
  KeyRound,
  Copy,
  Check,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { StatTile } from "@/components/ui/stat-tile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Field } from "@/components/ui/field";

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
  const [communitySuccess, setCommunitySuccess] = useState(false);
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

  const onTabChange = (value: string) => {
    if (!isTabId(value)) return;
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
    onSuccess: (res) => {
      setVerifyMessage(res.message);
    },
    onError: (err) => {
      setVerifyMessage(
        apiErrorMessage(err, "Could not resend verification email."),
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
    queryFn: () => api.get<CommunityMembership>("/community/me"),
    retry: false,
  });

  const joinCommunity = useMutation({
    mutationFn: () => api.post("/community/join", {}),
    onSuccess: async () => {
      setCommunityError(null);
      setCommunitySuccess(true);
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
      setSecurityFlash("Scan or enter this secret in your authenticator app, then confirm below.");
    },
    onError: (err) => {
      setSecurityError(apiErrorMessage(err, "Could not start 2FA setup"));
    },
  });

  const enable2fa = useMutation({
    mutationFn: () => api.post<SessionUser>("/auth/2fa/enable", { code: enableCode }),
    onSuccess: async () => {
      setSecurityError(null);
      setTwoFactorSetup(null);
      setEnableCode("");
      setSecurityFlash("Two-factor authentication is now enabled.");
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
      setSecurityFlash("Two-factor authentication has been disabled.");
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
  const tabCopy = useMemo(() => {
    switch (tab) {
      case "security":
        return "Authenticator 2FA is required before you can withdraw funds.";
      case "kyc":
        return "Verify your identity before investing or withdrawing.";
      case "support":
        return "Send our team a message — payments, courses, KYC or general help.";
      case "society":
        return "Connect with learners and investors in the Volt community.";
      default:
        return "Update your details, review account status, and manage access.";
    }
  }, [tab]);

  return (
    <div className="relative space-y-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-6 h-52 rounded-[2rem] bg-[radial-gradient(55%_80%_at_8%_0%,hsl(350_73%_44%/0.22),transparent_60%),radial-gradient(45%_70%_at_92%_0%,hsl(349_74%_36%/0.14),transparent_55%)]"
      />

      <div className="relative">
        <p className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
          <UserRound className="h-3.5 w-3.5" />
          Account
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">{tabCopy}</p>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden rounded-[1.75rem] border border-volt/30 bg-gradient-to-br from-volt/20 via-surface to-[hsl(0_0%_10%/0.12)] p-5 shadow-card sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-volt/30 blur-3xl"
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-volt/40 to-[hsl(351_77%_61%/0.35)] font-display text-xl font-bold text-foreground shadow-volt">
              {initials(user?.fullName)}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
                Member
              </p>
              <h2 className="truncate font-display text-2xl font-bold tracking-tight">
                {user?.fullName ?? "Your profile"}
              </h2>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {user?.email ?? user?.phone ?? "—"}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant={statusVariant(kycStatus)}>KYC · {humanize(kycStatus)}</Badge>
                <Badge variant={user?.emailVerified ? "success" : "warning"}>
                  {user?.emailVerified ? "Email verified" : "Email unverified"}
                </Badge>
                {user?.role ? <Badge variant="default">{humanize(user.role)}</Badge> : null}
              </div>
            </div>
          </div>
          <Button variant="ghost" className="w-fit shrink-0" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Log out
          </Button>
        </div>
      </section>

      <div className="relative grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="KYC"
          value={humanize(kycStatus)}
          icon={ShieldCheck}
          tone={kycApproved ? "green" : kycStatus === "PENDING" ? "amber" : "ink"}
        />
        <StatTile
          label="Email"
          value={user?.emailVerified ? "Verified" : "Pending"}
          icon={Mail}
          tone={user?.emailVerified ? "green" : "amber"}
        />
        <StatTile
          label="Society"
          value={societyStatus ? humanize(societyStatus) : "Not joined"}
          icon={Users}
          tone={societyStatus === "ACTIVE" ? "blue" : "ink"}
        />
        <StatTile
          label="Member since"
          value={user?.createdAt ? formatDate(user.createdAt) : "—"}
          icon={Calendar}
          tone="gold"
        />
      </div>

      <Tabs value={tab} onValueChange={onTabChange} className="relative space-y-5">
        <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="flex w-max min-w-full gap-1 rounded-2xl border border-volt/20 bg-gradient-to-br from-volt/10 via-surface to-[hsl(349_74%_36%/0.08)] p-1.5 sm:w-full sm:min-w-0">
            {TABS.map((item) => (
              <TabsTrigger key={item.id} value={item.id}>
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                  {item.id === "security" ? (
                    <Badge
                      variant={user?.twoFactorEnabled ? "success" : "warning"}
                      className="ml-0.5 hidden sm:inline-flex"
                    >
                      {user?.twoFactorEnabled ? "On" : "Off"}
                    </Badge>
                  ) : null}
                  {item.id === "kyc" ? (
                    <Badge variant={statusVariant(kycStatus)} className="ml-0.5 hidden sm:inline-flex">
                      {humanize(kycStatus)}
                    </Badge>
                  ) : null}
                  {item.id === "society" && communityQuery.data ? (
                    <Badge
                      variant={statusVariant(communityQuery.data.status)}
                      className="ml-0.5 hidden sm:inline-flex"
                    >
                      {humanize(communityQuery.data.status)}
                    </Badge>
                  ) : null}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* PROFILE */}
        <TabsContent value="profile" className="mt-0">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)] lg:items-start">
            <Panel
              title="Profile details"
              description="Update the name and phone we use across Volt Trades."
              icon={UserRound}
            >
              <form
                className="grid grid-cols-1 gap-4 sm:grid-cols-2"
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
                  <Input
                    id="country"
                    placeholder="Tanzania"
                    {...profileForm.register("country")}
                  />
                </Field>
                <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                  <Button type="submit" variant="primary" disabled={updateProfile.isPending}>
                    {updateProfile.isPending ? "Saving…" : "Save changes"}
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

            <aside className="space-y-4 lg:sticky lg:top-24">
              <div className="overflow-hidden rounded-[1.75rem] border border-border bg-surface shadow-card">
                <div className="border-b border-border bg-gradient-to-br from-volt/15 via-surface to-[hsl(0_0%_10%/0.1)] px-5 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
                    Account snapshot
                  </p>
                  <p className="mt-1 font-display text-lg font-bold tracking-tight">Sign-in identity</p>
                </div>
                <div className="space-y-2 p-4">
                  <Meta label="Email" value={user?.email ?? "—"} />
                  <Meta
                    label="Email status"
                    value={user?.emailVerified ? "Verified" : "Not verified"}
                  />
                  <Meta label="Role" value={user ? humanize(user.role) : "—"} />
                  <Meta label="Member since" value={formatDate(user?.createdAt)} />
                </div>
                {user?.email && !user.emailVerified ? (
                  <div className="border-t border-border px-4 py-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full rounded-full"
                      disabled={resendVerification.isPending}
                      onClick={() => resendVerification.mutate()}
                    >
                      {resendVerification.isPending ? "Sending…" : "Resend verification email"}
                    </Button>
                    {verifyMessage ? (
                      <p className="mt-2 text-center text-xs text-muted-foreground">{verifyMessage}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </aside>
          </div>
        </TabsContent>

        {/* SECURITY / 2FA */}
        <TabsContent value="security" className="mt-0">
          <Panel
            title="Two-factor authentication"
            description="Required for withdrawals. Use Google Authenticator, Authy, or similar."
            icon={KeyRound}
            action={
              <Badge variant={user?.twoFactorEnabled ? "success" : "warning"}>
                {user?.twoFactorEnabled ? "Enabled" : "Not enabled"}
              </Badge>
            }
          >
            {securityFlash ? <Alert variant="volt">{securityFlash}</Alert> : null}
            {securityError ? <Alert variant="danger">{securityError}</Alert> : null}

            {user?.twoFactorEnabled ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  2FA is on. Withdrawals require a fresh 6-digit code from your authenticator.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="disable-totp">Authenticator code</Label>
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
                    <Label htmlFor="disable-password">Account password</Label>
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
              <div className="space-y-4">
                {!twoFactorSetup ? (
                  <Button
                    variant="primary"
                    disabled={setup2fa.isPending}
                    onClick={() => {
                      setSecurityFlash(null);
                      setSecurityError(null);
                      setup2fa.mutate();
                    }}
                  >
                    {setup2fa.isPending ? "Preparing…" : "Set up authenticator"}
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-border bg-surface-2/40 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Manual secret
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <code className="break-all font-mono text-sm font-semibold">
                          {twoFactorSetup.secret}
                        </code>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            await navigator.clipboard.writeText(twoFactorSetup.secret);
                            setCopiedSecret(true);
                            window.setTimeout(() => setCopiedSecret(false), 1500);
                          }}
                        >
                          {copiedSecret ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          Copy
                        </Button>
                      </div>
                      <a
                        href={twoFactorSetup.otpauthUrl}
                        className="mt-3 inline-block text-sm font-semibold text-volt-dim underline"
                      >
                        Open in authenticator app
                      </a>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="enable-totp">Confirm with 6-digit code</Label>
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
                      disabled={enable2fa.isPending || enableCode.length !== 6}
                      onClick={() => {
                        setSecurityFlash(null);
                        enable2fa.mutate();
                      }}
                    >
                      {enable2fa.isPending ? "Enabling…" : "Enable 2FA"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Panel>
        </TabsContent>

        {/* KYC */}
        <TabsContent value="kyc" className="mt-0">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)] lg:items-start">
            <Panel
              title="Identity verification"
              description="Required before investing or withdrawing funds."
              icon={ShieldCheck}
              action={<Badge variant={statusVariant(kycStatus)}>{humanize(kycStatus)}</Badge>}
            >
              {kycQuery.isLoading ? (
                <Skeleton className="h-28 w-full rounded-xl" />
              ) : kycApproved ? (
                <div className="rounded-2xl border border-success/25 bg-gradient-to-br from-success/10 via-surface to-surface p-5">
                  <div className="flex items-start gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-success/15 text-success">
                      <BadgeCheck className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-semibold tracking-tight">Identity verified</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Your KYC is approved. You can invest and request withdrawals when the
                        feature is enabled for your account.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <form
                  className="flex flex-col gap-4"
                  onSubmit={kycForm.handleSubmit((values) => {
                    setKycSuccess(false);
                    submitKyc.mutate({
                      ...values,
                      backImageKey: values.backImageKey ? values.backImageKey : undefined,
                      selfieKey: values.selfieKey ? values.selfieKey : undefined,
                    });
                  })}
                >
                  {kycQuery.data?.submission?.reviewerNote ? (
                    <p className="rounded-xl border border-border bg-surface-2/60 px-3 py-2.5 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Reviewer note: </span>
                      {kycQuery.data.submission.reviewerNote}
                    </p>
                  ) : null}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Document type" htmlFor="documentType">
                      <Select id="documentType" {...kycForm.register("documentType")}>
                        <option value="NATIONAL_ID">National ID</option>
                        <option value="PASSPORT">Passport</option>
                        <option value="DRIVER_LICENSE">Driver&apos;s license</option>
                      </Select>
                    </Field>
                    <Field
                      label="Document number"
                      htmlFor="documentNumber"
                      error={kycForm.formState.errors.documentNumber?.message}
                    >
                      <Input id="documentNumber" {...kycForm.register("documentNumber")} />
                    </Field>
                    <Field
                      label="Front image key"
                      htmlFor="frontImageKey"
                      error={kycForm.formState.errors.frontImageKey?.message}
                    >
                      <Input
                        id="frontImageKey"
                        placeholder="manual-review/…"
                        {...kycForm.register("frontImageKey")}
                      />
                    </Field>
                    <Field label="Back image key (optional)" htmlFor="backImageKey">
                      <Input
                        id="backImageKey"
                        placeholder="manual-review/…"
                        {...kycForm.register("backImageKey")}
                      />
                    </Field>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Secure file upload via presigned URL is coming soon. For now, enter a reference
                    key — our team will match it during manual review.
                  </p>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit" variant="primary" disabled={submitKyc.isPending}>
                      {submitKyc.isPending ? "Submitting…" : "Submit for review"}
                    </Button>
                    {kycSuccess ? (
                      <span className="text-sm text-success">Submitted for review.</span>
                    ) : null}
                  </div>
                  {submitKyc.error ? (
                    <Alert variant="danger">
                      {apiErrorMessage(submitKyc.error, "Could not submit")}
                    </Alert>
                  ) : null}
                </form>
              )}
            </Panel>

            <aside className="lg:sticky lg:top-24">
              <div className="overflow-hidden rounded-[1.75rem] border border-border bg-surface shadow-card">
                <div className="border-b border-border bg-gradient-to-br from-success/10 via-surface to-surface px-5 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-success">
                    Why KYC
                  </p>
                  <p className="mt-1 font-display text-lg font-bold tracking-tight">Protects your capital</p>
                </div>
                <ul className="space-y-3 p-5 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-volt-dim" />
                    Needed before real-money invest & withdraw flows.
                  </li>
                  <li className="flex gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-volt-dim" />
                    Helps us verify you own the account and payout destination.
                  </li>
                  <li className="flex gap-2">
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-volt-dim" />
                    Review is manual for now — status updates appear here.
                  </li>
                </ul>
                {kycQuery.data?.submission ? (
                  <div className="border-t border-border p-4">
                    <Meta
                      label="Last submission"
                      value={`${humanize(kycQuery.data.submission.documentType)} · ${formatDate(kycQuery.data.submission.createdAt)}`}
                    />
                  </div>
                ) : null}
              </div>
            </aside>
          </div>
        </TabsContent>

        {/* SUPPORT */}
        <TabsContent value="support" className="mt-0">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)] lg:items-start">
            <Panel
              title="Contact support"
              description="Tell us what you need — we’ll follow up by email."
              icon={LifeBuoy}
            >
              <form
                className="flex flex-col gap-4"
                onSubmit={supportForm.handleSubmit((values) => {
                  setSupportSuccess(false);
                  submitTicket.mutate(values);
                })}
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  <Textarea id="message" rows={5} {...supportForm.register("message")} />
                </Field>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" variant="primary" disabled={submitTicket.isPending}>
                    {submitTicket.isPending ? "Sending…" : "Send message"}
                  </Button>
                  {supportSuccess ? (
                    <span className="text-sm text-success">
                      Ticket submitted — we&apos;ll be in touch.
                    </span>
                  ) : null}
                </div>
                {submitTicket.error ? (
                  <Alert variant="danger">
                    {apiErrorMessage(submitTicket.error, "Could not send message")}
                  </Alert>
                ) : null}
              </form>
            </Panel>

            <aside className="lg:sticky lg:top-24">
              <div className="overflow-hidden rounded-[1.75rem] border border-border bg-surface shadow-card">
                <div className="border-b border-border bg-gradient-to-br from-[hsl(0_0%_10%/0.14)] via-surface to-surface px-5 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--accent-blue))]">
                    Before you write
                  </p>
                  <p className="mt-1 font-display text-lg font-bold tracking-tight">Faster answers</p>
                </div>
                <ul className="space-y-3 p-5 text-sm text-muted-foreground">
                  <li>Include payment reference or investment ID if relevant.</li>
                  <li>For KYC, mention document type and submission date.</li>
                  <li>We respond to the email on your account.</li>
                </ul>
              </div>
            </aside>
          </div>
        </TabsContent>

        {/* SOCIETY */}
        <TabsContent value="society" className="mt-0">
          <Panel
            title="Volt Society"
            description="Learn, connect and build with other Volt members."
            icon={Users}
          >
            {communityQuery.isLoading ? (
              <Skeleton className="h-24 w-full rounded-xl" />
            ) : communityQuery.data ? (
              <div className="relative overflow-hidden rounded-2xl border border-[hsl(var(--accent-blue)/0.28)] bg-gradient-to-br from-[hsl(var(--accent-blue)/0.14)] via-surface to-surface p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[hsl(var(--accent-blue)/0.15)] text-[hsl(var(--accent-blue))]">
                      <Users className="h-5 w-5" />
                    </span>
                    <div>
                      <Badge variant={statusVariant(communityQuery.data.status)}>
                        Member — {humanize(communityQuery.data.status)}
                      </Badge>
                      {communityQuery.data.joinedAt ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          Joined {formatDate(communityQuery.data.joinedAt)}
                        </p>
                      ) : null}
                      <p className="mt-1 text-sm text-muted-foreground">
                        You&apos;re on the Volt Society list. Updates will appear as community
                        activities open.
                      </p>
                    </div>
                  </div>
                  <Sparkles className="hidden h-8 w-8 text-volt-dim sm:block" />
                </div>
              </div>
            ) : (
              <div className="relative overflow-hidden rounded-2xl border border-volt/25 bg-gradient-to-br from-volt/12 via-surface to-surface p-5">
                <p className="text-sm text-muted-foreground">
                  Request membership to learn, connect and build with other Volt members.
                </p>
                <Button
                  variant="secondary"
                  className="mt-4 w-fit rounded-full"
                  onClick={() => joinCommunity.mutate()}
                  disabled={joinCommunity.isPending}
                >
                  {joinCommunity.isPending ? "Joining…" : "Join Volt Society"}
                </Button>
              </div>
            )}
            {communitySuccess ? (
              <p className="mt-3 text-sm text-success">Welcome to Volt Society.</p>
            ) : null}
            {communityError ? (
              <Alert variant="danger" className="mt-3">
                {communityError}
              </Alert>
            ) : null}
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Panel({
  title,
  description,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-[1.75rem] border border-border bg-gradient-to-br from-surface via-surface to-surface-2 shadow-card">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-volt via-[hsl(349_74%_36%)] to-[hsl(349_74%_36%)] opacity-80"
      />
      <div className="space-y-4 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-volt/15 text-volt-dim">
              <Icon className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold tracking-tight">{title}</h2>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
          {action}
        </div>
        {children}
      </div>
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-surface-2/40 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 break-all text-sm font-medium">{value}</p>
    </div>
  );
}
