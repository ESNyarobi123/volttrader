import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const alertVariants = cva("rounded-lg border p-4 text-sm", {
  variants: {
    variant: {
      default: "border-border bg-surface-2 text-foreground",
      volt: "border-volt/40 bg-volt/5 text-foreground",
      danger: "border-danger/40 bg-danger/10 text-danger",
      /* Soft neutral — avoid loud orange “warning boxes” in product UI */
      warning: "border-border bg-surface-2 text-foreground",
      info: "border-border bg-surface-2 text-muted-foreground",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface AlertProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {}

export function Alert({ className, variant, ...props }: AlertProps) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

export function AlertTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h5 className={cn("mb-1 font-semibold", className)} {...props} />;
}
