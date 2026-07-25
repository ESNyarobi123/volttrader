"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LifeBuoy,
  Shield,
  Wallet,
  Server,
  Save,
  AlertTriangle,
  Landmark,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { CURRENCY_MINOR_UNITS, type Currency } from "@volt/config";
import type { Money } from "@volt/types";
import { api, ApiRequestError } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatMoney, toMinorUnits } from "@/lib/format";
import { cn } from "@/lib/utils";

interface SettingsPayload {
  editable: {
    supportEmail: string | null;
    supportPhone: string | null;
    supportHours: string | null;
    maintenanceMode: boolean;
    registrationOpen: boolean;
    communityOpen: boolean;
    minDeposit: Money;
    minWithdrawal: Money;
    depositMobileProvider: string | null;
    depositMobileNumber: string | null;
    depositMobileName: string | null;
    depositBankName: string | null;
    depositBankAccount: string | null;
    depositBankAccountName: string | null;
    depositInstructions: string | null;
    depositManualEnabled: boolean;
    depositOnlineEnabled: boolean;
  };
  runtime: {
    brandName: string;
    brandTagline: string;
    currency: string;
    paymentGateway: string;
    flutterwaveConfigured: boolean;
    allowMockPayments: boolean;
    featureRealMoneyInvestments: boolean;
    nodeEnv: string;
    mailFrom: string | null;
    s3Bucket: string | null;
  };
  meta: {
    updatedAt: string;
    updatedById: string | null;
  };
}

interface FormState {
  supportEmail: string;
  supportPhone: string;
  supportHours: string;
  maintenanceMode: boolean;
  registrationOpen: boolean;
  communityOpen: boolean;
  minDepositMajor: string;
  minWithdrawalMajor: string;
  depositMobileProvider: string;
  depositMobileNumber: string;
  depositMobileName: string;
  depositBankName: string;
  depositBankAccount: string;
  depositBankAccountName: string;
  depositInstructions: string;
  depositManualEnabled: boolean;
  depositOnlineEnabled: boolean;
}

function toMajorString(money: Money) {
  const minor = CURRENCY_MINOR_UNITS[money.currency as Currency] ?? 100;
  return String(money.amount / minor);
}

function fromPayload(data: SettingsPayload): FormState {
  return {
    supportEmail: data.editable.supportEmail ?? "",
    supportPhone: data.editable.supportPhone ?? "",
    supportHours: data.editable.supportHours ?? "",
    maintenanceMode: data.editable.maintenanceMode,
    registrationOpen: data.editable.registrationOpen,
    communityOpen: data.editable.communityOpen,
    minDepositMajor: toMajorString(data.editable.minDeposit),
    minWithdrawalMajor: toMajorString(data.editable.minWithdrawal),
    depositMobileProvider: data.editable.depositMobileProvider ?? "",
    depositMobileNumber: data.editable.depositMobileNumber ?? "",
    depositMobileName: data.editable.depositMobileName ?? "",
    depositBankName: data.editable.depositBankName ?? "",
    depositBankAccount: data.editable.depositBankAccount ?? "",
    depositBankAccountName: data.editable.depositBankAccountName ?? "",
    depositInstructions: data.editable.depositInstructions ?? "",
    depositManualEnabled: data.editable.depositManualEnabled ?? true,
    depositOnlineEnabled: data.editable.depositOnlineEnabled ?? true,
  };
}

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => api.get<SettingsPayload>("/admin/settings"),
  });

  useEffect(() => {
    if (data) setForm(fromPayload(data));
  }, [data]);

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.patch<SettingsPayload>("/admin/settings", payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(["admin-settings"], updated);
      setForm(fromPayload(updated));
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 2500);
    },
  });

  const currency = (data?.runtime.currency ?? "TZS") as Currency;

  const onSave = () => {
    if (!form) return;
    const deposit = Number(form.minDepositMajor);
    const withdrawal = Number(form.minWithdrawalMajor);
    if (!Number.isFinite(deposit) || deposit < 0) return;
    if (!Number.isFinite(withdrawal) || withdrawal < 0) return;

    save.mutate({
      supportEmail: form.supportEmail.trim() || null,
      supportPhone: form.supportPhone.trim() || null,
      supportHours: form.supportHours.trim() || null,
      maintenanceMode: form.maintenanceMode,
      registrationOpen: form.registrationOpen,
      communityOpen: form.communityOpen,
      minDepositMinor: toMinorUnits(deposit, currency),
      minWithdrawalMinor: toMinorUnits(withdrawal, currency),
      depositMobileProvider: form.depositMobileProvider.trim() || null,
      depositMobileNumber: form.depositMobileNumber.trim() || null,
      depositMobileName: form.depositMobileName.trim() || null,
      depositBankName: form.depositBankName.trim() || null,
      depositBankAccount: form.depositBankAccount.trim() || null,
      depositBankAccountName: form.depositBankAccountName.trim() || null,
      depositInstructions: form.depositInstructions.trim() || null,
      depositManualEnabled: form.depositManualEnabled,
      depositOnlineEnabled: form.depositOnlineEnabled,
    });
  };

  const saveError =
    save.error instanceof ApiRequestError
      ? save.error.message
      : save.isError
        ? "Could not save settings."
        : null;

  const dirty =
    !!data &&
    !!form &&
    (form.supportEmail !== (data.editable.supportEmail ?? "") ||
      form.supportPhone !== (data.editable.supportPhone ?? "") ||
      form.supportHours !== (data.editable.supportHours ?? "") ||
      form.maintenanceMode !== data.editable.maintenanceMode ||
      form.registrationOpen !== data.editable.registrationOpen ||
      form.communityOpen !== data.editable.communityOpen ||
      form.minDepositMajor !== toMajorString(data.editable.minDeposit) ||
      form.minWithdrawalMajor !== toMajorString(data.editable.minWithdrawal) ||
      form.depositMobileProvider !== (data.editable.depositMobileProvider ?? "") ||
      form.depositMobileNumber !== (data.editable.depositMobileNumber ?? "") ||
      form.depositMobileName !== (data.editable.depositMobileName ?? "") ||
      form.depositBankName !== (data.editable.depositBankName ?? "") ||
      form.depositBankAccount !== (data.editable.depositBankAccount ?? "") ||
      form.depositBankAccountName !== (data.editable.depositBankAccountName ?? "") ||
      form.depositInstructions !== (data.editable.depositInstructions ?? "") ||
      form.depositManualEnabled !== data.editable.depositManualEnabled ||
      form.depositOnlineEnabled !== data.editable.depositOnlineEnabled);

  return (
    <div className="relative space-y-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-6 h-40 rounded-[2rem] bg-[radial-gradient(55%_80%_at_8%_0%,hsl(350_73%_44%/0.2),transparent_60%),radial-gradient(45%_70%_at_92%_0%,hsl(349_74%_36%/0.12),transparent_55%)]"
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
            System · Platform
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure support contact, access gates, and money thresholds.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data?.meta.updatedAt ? (
            <span className="text-xs text-muted-foreground">
              Updated {formatDate(data.meta.updatedAt)}
            </span>
          ) : null}
          <Button
            onClick={onSave}
            disabled={!form || !dirty || save.isPending}
            className="shadow-volt"
          >
            <Save className="h-4 w-4" />
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      {savedFlash ? (
        <Alert variant="volt">Settings saved. Change is audit-logged.</Alert>
      ) : null}
      {saveError ? <Alert variant="danger">{saveError}</Alert> : null}

      {isLoading || !form ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <Alert variant="danger">
          {error instanceof ApiRequestError ? error.message : "Could not load settings."}
        </Alert>
      ) : (
        <div className="relative grid gap-5 lg:grid-cols-2">
          <Section
            icon={LifeBuoy}
            title="Support contact"
            description="Shown to members when they need help."
          >
            <Field label="Support email" htmlFor="supportEmail">
              <Input
                id="supportEmail"
                type="email"
                value={form.supportEmail}
                onChange={(e) => setForm({ ...form, supportEmail: e.target.value })}
                placeholder="support@volttrades.com"
              />
            </Field>
            <Field label="Support phone" htmlFor="supportPhone">
              <Input
                id="supportPhone"
                value={form.supportPhone}
                onChange={(e) => setForm({ ...form, supportPhone: e.target.value })}
                placeholder="+255 …"
              />
            </Field>
            <Field label="Support hours" htmlFor="supportHours">
              <Input
                id="supportHours"
                value={form.supportHours}
                onChange={(e) => setForm({ ...form, supportHours: e.target.value })}
                placeholder="Mon–Fri 09:00–17:00 EAT"
              />
            </Field>
          </Section>

          <Section
            icon={Shield}
            title="Access & gates"
            description="Control who can join and when the platform is open."
          >
            <ToggleRow
              id="maintenance"
              label="Maintenance mode"
              hint="Pause public activity while you work on the platform."
              checked={form.maintenanceMode}
              onCheckedChange={(v) => setForm({ ...form, maintenanceMode: v })}
              danger
            />
            <ToggleRow
              id="registration"
              label="Registration open"
              hint="Allow new members to create accounts."
              checked={form.registrationOpen}
              onCheckedChange={(v) => setForm({ ...form, registrationOpen: v })}
            />
            <ToggleRow
              id="community"
              label="Community open"
              hint="Accept new Volt Society membership requests."
              checked={form.communityOpen}
              onCheckedChange={(v) => setForm({ ...form, communityOpen: v })}
            />
          </Section>

          <Section
            icon={Wallet}
            title="Money thresholds"
            description={`Amounts in ${currency} major units. Stored as integer minor units.`}
          >
            <Field label={`Minimum deposit (${currency})`} htmlFor="minDeposit">
              <Input
                id="minDeposit"
                type="number"
                min={0}
                step="1"
                value={form.minDepositMajor}
                onChange={(e) => setForm({ ...form, minDepositMajor: e.target.value })}
              />
            </Field>
            <Field label={`Minimum withdrawal (${currency})`} htmlFor="minWithdrawal">
              <Input
                id="minWithdrawal"
                type="number"
                min={0}
                step="1"
                value={form.minWithdrawalMajor}
                onChange={(e) => setForm({ ...form, minWithdrawalMajor: e.target.value })}
              />
            </Field>
            {data ? (
              <p className="text-xs text-muted-foreground">
                Current floors: {formatMoney(data.editable.minDeposit)} deposit ·{" "}
                {formatMoney(data.editable.minWithdrawal)} withdrawal
              </p>
            ) : null}
          </Section>

          <Section
            icon={Smartphone}
            title="Deposit payment details"
            description="Shown to members when they deposit. Wallet credits only after finance confirms (manual) or verified webhook (online)."
          >
            <ToggleRow
              id="depositManual"
              label="Manual bank / mobile money"
              hint="Members pay to published accounts, then submit a reference for finance review."
              checked={form.depositManualEnabled}
              onCheckedChange={(v) => setForm({ ...form, depositManualEnabled: v })}
            />
            <ToggleRow
              id="depositOnline"
              label="Online checkout gateway"
              hint="Uses PAYMENT_DEFAULT_GATEWAY from server env (secrets never stored here)."
              checked={form.depositOnlineEnabled}
              onCheckedChange={(v) => setForm({ ...form, depositOnlineEnabled: v })}
            />
            {data ? (
              <div className="rounded-xl border border-border/70 bg-surface-2/40 px-3 py-3 text-xs text-muted-foreground">
                <p>
                  Default gateway:{" "}
                  <span className="font-semibold text-foreground">
                    {data.runtime.paymentGateway}
                  </span>
                </p>
                <p className="mt-1">
                  Flutterwave keys:{" "}
                  {data.runtime.flutterwaveConfigured ? "configured" : "not set in env"}
                  {" · "}
                  Mock payments: {data.runtime.allowMockPayments ? "allowed" : "off"}
                </p>
              </div>
            ) : null}
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Mobile money
            </p>
            <Field label="Provider" htmlFor="depositMobileProvider">
              <Input
                id="depositMobileProvider"
                value={form.depositMobileProvider}
                onChange={(e) => setForm({ ...form, depositMobileProvider: e.target.value })}
                placeholder="M-Pesa / TigoPesa / Airtel Money"
              />
            </Field>
            <Field label="Number" htmlFor="depositMobileNumber">
              <Input
                id="depositMobileNumber"
                value={form.depositMobileNumber}
                onChange={(e) => setForm({ ...form, depositMobileNumber: e.target.value })}
                placeholder="2557…"
              />
            </Field>
            <Field label="Account name" htmlFor="depositMobileName">
              <Input
                id="depositMobileName"
                value={form.depositMobileName}
                onChange={(e) => setForm({ ...form, depositMobileName: e.target.value })}
                placeholder="Volt Trades Ltd"
              />
            </Field>
            <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Bank transfer
            </p>
            <Field label="Bank name" htmlFor="depositBankName">
              <Input
                id="depositBankName"
                value={form.depositBankName}
                onChange={(e) => setForm({ ...form, depositBankName: e.target.value })}
                placeholder="CRDB Bank"
              />
            </Field>
            <Field label="Account number" htmlFor="depositBankAccount">
              <Input
                id="depositBankAccount"
                value={form.depositBankAccount}
                onChange={(e) => setForm({ ...form, depositBankAccount: e.target.value })}
                placeholder="0150…"
              />
            </Field>
            <Field label="Account name" htmlFor="depositBankAccountName">
              <Input
                id="depositBankAccountName"
                value={form.depositBankAccountName}
                onChange={(e) => setForm({ ...form, depositBankAccountName: e.target.value })}
                placeholder="Volt Trades Ltd"
              />
            </Field>
            <Field label="Instructions for members" htmlFor="depositInstructions">
              <Textarea
                id="depositInstructions"
                rows={3}
                value={form.depositInstructions}
                onChange={(e) => setForm({ ...form, depositInstructions: e.target.value })}
                placeholder="Send the exact amount, then submit your transaction ID…"
              />
            </Field>
            <p className="inline-flex items-start gap-2 text-xs text-muted-foreground">
              <Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Leave a channel blank to hide it on the member wallet deposit screen.
            </p>
          </Section>

          <Section
            icon={Server}
            title="Runtime environment"
            description="Read-only values from deployment env. Change via .env / deploy."
          >
            <RuntimeRow label="Brand" value={data!.runtime.brandName} />
            <RuntimeRow label="Tagline" value={data!.runtime.brandTagline} />
            <RuntimeRow label="Currency" value={data!.runtime.currency} />
            <RuntimeRow label="Payment gateway" value={data!.runtime.paymentGateway} />
            <RuntimeRow label="Environment" value={data!.runtime.nodeEnv} />
            <RuntimeRow label="Mail from" value={data!.runtime.mailFrom ?? "—"} />
            <RuntimeRow label="S3 bucket" value={data!.runtime.s3Bucket ?? "—"} />
            <div className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-surface-2/40 px-3 py-3">
              <div>
                <p className="text-sm font-medium">Real-money investments</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Controlled by FEATURE_REAL_MONEY_INVESTMENTS (legal gate).
                </p>
              </div>
              <Badge
                variant={data!.runtime.featureRealMoneyInvestments ? "warning" : "default"}
              >
                {data!.runtime.featureRealMoneyInvestments ? "Enabled" : "Off"}
              </Badge>
            </div>
            {data!.runtime.featureRealMoneyInvestments ? (
              <p className="inline-flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-foreground/50" />
                Real-money mode is on. Confirm legal/compliance review before launch.
              </p>
            ) : null}
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="relative overflow-hidden border-border bg-gradient-to-br from-surface via-surface to-surface-2 shadow-card">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-volt via-[hsl(349_74%_36%)] to-[hsl(349_74%_36%)] opacity-80"
      />
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-volt/25 to-[hsl(349_74%_36%/0.2)] text-volt-dim">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold tracking-tight">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="space-y-3">{children}</div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  onCheckedChange,
  danger,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  danger?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 rounded-xl border px-3 py-3",
        danger && checked
          ? "border-warning/40 bg-warning/10"
          : "border-border/70 bg-surface-2/40",
      )}
    >
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function RuntimeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-0">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="truncate text-sm font-medium">{value}</span>
    </div>
  );
}
