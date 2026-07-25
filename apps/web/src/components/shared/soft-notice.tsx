import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Quiet inline notice for KYC prompts / tips — not a warning Alert.
 * Use Alert variant="danger" only for real errors.
 */
export function SoftNotice({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon?: LucideIcon;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-border/80 bg-surface/90 px-4 py-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        {Icon ? (
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted-foreground">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0">
          {title ? (
            <p className="text-sm font-semibold tracking-tight text-foreground">{title}</p>
          ) : null}
          <div
            className={cn(
              "text-sm leading-relaxed text-muted-foreground",
              title && "mt-0.5",
            )}
          >
            {children}
          </div>
        </div>
      </div>
      {action ? <div className="shrink-0 sm:pl-2">{action}</div> : null}
    </div>
  );
}
