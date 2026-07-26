"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const STORAGE_PREFIX = "volt:kyc-nudge:dismissed:";

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

/**
 * Soft welcome popup for members who still need KYC.
 * Dismissible; does not block Learn / browse.
 */
export function KycWelcomeDialog() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    if (user.kycStatus === "APPROVED") return;
    // Pending review — no need to nudge again until status changes.
    if (user.kycStatus === "PENDING") return;

    try {
      if (window.localStorage.getItem(storageKey(user.id)) === "1") return;
    } catch {
      /* ignore */
    }

    const t = window.setTimeout(() => setOpen(true), 450);
    return () => window.clearTimeout(t);
  }, [loading, user]);

  const dismiss = () => {
    if (user?.id) {
      try {
        window.localStorage.setItem(storageKey(user.id), "1");
      } catch {
        /* ignore */
      }
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : dismiss())}>
      <DialogContent
        className="max-w-md overflow-hidden border-0 bg-transparent p-0 shadow-none"
        onClose={dismiss}
      >
        <div className="overflow-hidden rounded-2xl border border-volt/30 bg-surface shadow-lift">
          <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-volt/20 via-surface to-surface px-6 pb-5 pt-6">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-volt/30 blur-3xl"
            />
            <div className="relative flex items-start gap-3 pr-8">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-ink/90 text-white shadow-sm">
                <ShieldCheck className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-volt-dim">
                  Verification
                </p>
                <DialogTitle className="mt-1 font-display text-xl font-bold tracking-tight">
                  KYC needed before investing or withdrawing
                </DialogTitle>
              </div>
            </div>
          </div>

          <div className="space-y-5 px-6 py-5">
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              Complete verification when you&apos;re ready — you can still browse and learn now.
            </DialogDescription>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={dismiss}
              >
                Later
              </Button>
              <Link
                href="/dashboard/profile?tab=kyc"
                onClick={dismiss}
                className={cn(
                  buttonVariants({ size: "md" }),
                  "justify-center rounded-full shadow-volt",
                )}
              >
                Verify KYC
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
