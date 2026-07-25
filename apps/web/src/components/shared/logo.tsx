import Link from "next/link";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-bold tracking-tight", className)}>
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-volt text-volt-foreground shadow-volt">
        <Zap className="h-5 w-5" aria-hidden />
      </span>
      <span className="text-lg">
        Volt<span className="text-volt-dim">Trades</span>
      </span>
    </Link>
  );
}
