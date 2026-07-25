"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { registerSchema, type RegisterInput } from "@volt/validation";
import { useAuth } from "@/lib/auth";
import { ApiRequestError } from "@/lib/api";
import { CountrySelect, DialCodeSelect } from "@/components/auth/country-select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  DEFAULT_COUNTRY_ISO,
  getCountry,
  type CountryOption,
} from "@/lib/countries";
import { cn } from "@/lib/utils";

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function buildE164(dial: string, national: string) {
  const n = digitsOnly(national);
  if (!n) return undefined;
  return `${dial}${n}`;
}

type Step = 1 | 2;

export default function RegisterEmailPage() {
  const router = useRouter();
  const { register: registerUser } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Warm the dashboard chunk so navigation after signup isn't a cold compile wait.
  useEffect(() => {
    router.prefetch("/dashboard");
  }, [router]);
  const [countryIso, setCountryIso] = useState(DEFAULT_COUNTRY_ISO);
  const [phoneIso, setPhoneIso] = useState(DEFAULT_COUNTRY_ISO);
  const [nationalPhone, setNationalPhone] = useState("");

  const phoneDial = useMemo(
    () => getCountry(phoneIso)?.dial ?? "+255",
    [phoneIso],
  );

  const {
    register,
    handleSubmit,
    control,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: undefined,
      password: "",
      country: "Tanzania",
      acceptedTerms: false,
    } as unknown as RegisterInput,
  });

  const syncPhoneField = (iso: string, national: string) => {
    const dial = getCountry(iso)?.dial ?? "+255";
    const e164 = buildE164(dial, national);
    setValue("phone", e164 as RegisterInput["phone"], { shouldValidate: step === 1 });
  };

  const onCountryChange = (country: CountryOption) => {
    setCountryIso(country.iso2);
    setValue("country", country.name, { shouldValidate: true });
    setPhoneIso(country.iso2);
    syncPhoneField(country.iso2, nationalPhone);
  };

  const onDialChange = (country: CountryOption) => {
    setPhoneIso(country.iso2);
    syncPhoneField(country.iso2, nationalPhone);
  };

  const goNext = async () => {
    setServerError(null);
    // Keep phone in sync before validating
    syncPhoneField(phoneIso, nationalPhone);
    const ok = await trigger(["fullName", "email", "phone", "password"]);
    // Allow empty phone if email is present — refine handles email|phone
    if (!ok) {
      // If only phone path missing because both empty, trigger already set email error
      return;
    }
    setStep(2);
  };

  const onSubmit = async (values: RegisterInput) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      const phone = buildE164(phoneDial, nationalPhone);
      const payload: RegisterInput = {
        ...values,
        email: values.email ? values.email : undefined,
        phone: phone || undefined,
        country: values.country ? values.country : undefined,
      };
      await registerUser(payload);
      router.replace("/dashboard");
    } catch (err) {
      setServerError(
        err instanceof ApiRequestError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to create your account. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-[1.75rem] border border-border/70 bg-surface px-6 py-8 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.18)] sm:px-8 sm:py-9">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link
          href={step === 1 ? "/register" : "#"}
          onClick={(e) => {
            if (step === 2) {
              e.preventDefault();
              setStep(1);
            }
          }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back
        </Link>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Step {step} of 2
        </p>
      </div>

      {/* Progress */}
      <div className="mb-6 flex gap-1.5" aria-hidden>
        <span className={cn("h-1 flex-1 rounded-full", step >= 1 ? "bg-volt" : "bg-border")} />
        <span className={cn("h-1 flex-1 rounded-full", step >= 2 ? "bg-volt" : "bg-border")} />
      </div>

      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-[1.75rem]">
          {step === 1 ? "Your details" : "Almost done"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {step === 1
            ? "Start with your name, contact, and a password."
            : "Confirm your country and accept the terms to finish."}
        </p>
      </div>

      <form className="flex flex-col gap-3.5" onSubmit={handleSubmit(onSubmit)} noValidate>
        {serverError ? (
          <div
            role="alert"
            className="rounded-xl border border-danger/25 bg-danger/5 px-3.5 py-3 text-sm text-danger"
          >
            {serverError}
          </div>
        ) : null}

        {step === 1 ? (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                type="text"
                autoComplete="name"
                placeholder="Jane Doe"
                className="h-11 rounded-xl bg-background"
                {...register("fullName")}
              />
              {errors.fullName ? (
                <p className="text-sm text-danger">{errors.fullName.message}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className="h-11 rounded-xl bg-background"
                {...register("email")}
              />
              {errors.email ? (
                <p className="text-sm text-danger">{errors.email.message}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phoneNational">Phone</Label>
              <div className="flex gap-2">
                <DialCodeSelect value={phoneIso} onChange={onDialChange} />
                <Input
                  id="phoneNational"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="700 000 000"
                  className="h-11 flex-1 rounded-xl bg-background"
                  value={nationalPhone}
                  onChange={(e) => {
                    const next = e.target.value;
                    setNationalPhone(next);
                    syncPhoneField(phoneIso, next);
                  }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Optional if you already entered email ·{" "}
                <span className="font-medium text-foreground/70">
                  {buildE164(phoneDial, nationalPhone) || `${phoneDial}…`}
                </span>
              </p>
              {errors.phone ? (
                <p className="text-sm text-danger">{errors.phone.message}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                className="h-11 rounded-xl bg-background"
                {...register("password")}
              />
              {errors.password ? (
                <p className="text-sm text-danger">{errors.password.message}</p>
              ) : null}
            </div>

            <Button
              type="button"
              size="lg"
              className="mt-2 h-12 w-full rounded-full shadow-volt"
              onClick={goNext}
            >
              Continue
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="country">Country</Label>
              <Controller
                name="country"
                control={control}
                render={() => (
                  <CountrySelect
                    id="country"
                    value={countryIso}
                    onChange={onCountryChange}
                  />
                )}
              />
              {errors.country ? (
                <p className="text-sm text-danger">{errors.country.message}</p>
              ) : null}
            </div>

            <div className="flex items-start gap-2.5 pt-1">
              <input
                id="acceptedTerms"
                type="checkbox"
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0 rounded border-border bg-background text-volt-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt",
                )}
                {...register("acceptedTerms")}
              />
              <Label
                htmlFor="acceptedTerms"
                className="font-normal leading-relaxed text-muted-foreground"
              >
                I accept the{" "}
                <Link href="/terms" className="font-medium text-volt-dim hover:underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="font-medium text-volt-dim hover:underline">
                  Privacy Policy
                </Link>
                .
              </Label>
            </div>
            {errors.acceptedTerms ? (
              <p className="text-sm text-danger">{errors.acceptedTerms.message}</p>
            ) : null}

            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              className="mt-2 h-12 w-full rounded-full shadow-volt"
            >
              {isSubmitting ? <Spinner /> : null}
              {isSubmitting ? "Creating…" : "Create account"}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              KYC is only required later, when you invest or withdraw.
            </p>
          </>
        )}

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-volt-dim transition-colors hover:text-foreground"
          >
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
