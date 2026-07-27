"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function PaymentMethodCard({
  active,
  iconSrc,
  iconAlt,
  title,
  subtitle,
  onClick,
  disabled,
}: {
  active: boolean;
  iconSrc: string;
  iconAlt: string;
  title: string;
  subtitle: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-[1.25rem] border p-3.5 text-left transition",
        disabled && "cursor-not-allowed opacity-45",
        active
          ? "border-volt bg-volt/12 shadow-[0_10px_28px_-18px_hsl(var(--volt)/0.55)]"
          : "border-border/80 bg-surface hover:border-volt/35",
      )}
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center">
        <img
          src={iconSrc}
          alt={iconAlt}
          className="h-11 w-11 object-contain drop-shadow-sm"
          draggable={false}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold tracking-tight">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{subtitle}</span>
      </span>
      <span
        className={cn(
          "grid h-6 w-6 shrink-0 place-items-center rounded-full border-2",
          active ? "border-volt bg-volt text-volt-foreground" : "border-border bg-surface",
        )}
        aria-hidden
      >
        {active ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
      </span>
    </button>
  );
}
