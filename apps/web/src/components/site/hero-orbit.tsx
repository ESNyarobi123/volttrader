"use client";

import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import {
  GraduationCap,
  TrendingUp,
  Wallet,
  Users,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { BRAND_ICON_3D } from "@/lib/brand";
import { cn } from "@/lib/utils";

type Floater =
  | {
      kind: "icon";
      icon: LucideIcon;
      label: string;
      className: string;
      tone: string;
      delay: string;
    }
  | {
      kind: "orb";
      className: string;
      tone: string;
      delay: string;
    };

const FLOATERS: Floater[] = [
  {
    kind: "icon",
    icon: GraduationCap,
    label: "Courses",
    className: "left-[6%] top-[18%] sm:left-[8%] sm:top-[16%]",
    tone: "from-volt to-[hsl(349_74%_36%)] text-volt-foreground",
    delay: "0s",
  },
  {
    kind: "icon",
    icon: TrendingUp,
    label: "Invest",
    className: "right-[4%] top-[22%] sm:right-[8%] sm:top-[18%]",
    tone: "from-[hsl(351_77%_61%)] to-[hsl(349_74%_36%)] text-white",
    delay: "0.4s",
  },
  {
    kind: "icon",
    icon: Wallet,
    label: "Wallet",
    className: "left-[2%] top-[48%] sm:left-[4%]",
    tone: "from-[hsl(142_65%_29%)] to-[hsl(142_62%_40%)] text-white",
    delay: "0.8s",
  },
  {
    kind: "icon",
    icon: Users,
    label: "Society",
    className: "right-[2%] top-[46%] sm:right-[5%]",
    tone: "from-[hsl(351_77%_61%)] to-[hsl(351_77%_61%)] text-white",
    delay: "1.1s",
  },
  {
    kind: "icon",
    icon: ShieldCheck,
    label: "KYC",
    className: "left-[14%] bottom-[16%] sm:left-[16%] sm:bottom-[14%]",
    tone: "from-[hsl(349_74%_36%)] to-volt text-volt-foreground",
    delay: "0.2s",
  },
  {
    kind: "icon",
    icon: Sparkles,
    label: "Projects",
    className: "right-[12%] bottom-[18%] sm:right-[14%] sm:bottom-[15%]",
    tone: "from-[hsl(0_70%_58%)] to-[hsl(349_74%_36%)] text-white",
    delay: "0.6s",
  },
  {
    kind: "orb",
    className: "left-[28%] top-[10%] h-4 w-4 sm:h-5 sm:w-5",
    tone: "bg-[hsl(0_0%_10%)]",
    delay: "0.3s",
  },
  {
    kind: "orb",
    className: "right-[30%] top-[12%] h-3 w-3 sm:h-3.5 sm:w-3.5",
    tone: "bg-volt",
    delay: "0.9s",
  },
  {
    kind: "orb",
    className: "left-[40%] bottom-[22%] h-2.5 w-2.5",
    tone: "bg-[hsl(351_77%_61%)]",
    delay: "1.3s",
  },
];

/**
 * Hero composition inspired by premium DeFi landings:
 * soft pedestal + central Volt badge + gently floating product chips.
 * No spinning carousel — that reads as noisy on this layout.
 */
export function HeroOrbit({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative mx-auto aspect-[1/1.05] w-full max-w-[440px] select-none",
        className,
      )}
      aria-hidden
    >
      {/* Soft ambient washes */}
      <div className="absolute inset-[8%] rounded-full bg-[radial-gradient(circle_at_50%_35%,hsl(0_0%_10%/0.2),transparent_58%)]" />
      <div className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle_at_50%_45%,hsl(350_73%_44%/0.16),transparent_60%)]" />

      {/* Subtle orbital guides (static, elliptical — not spinning) */}
      <div className="absolute left-1/2 top-[42%] h-[58%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-dashed border-foreground/8" />
      <div className="absolute left-1/2 top-[44%] h-[42%] w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-foreground/6" />

      {/* Pedestal — layered discs */}
      <div className="absolute inset-x-[12%] bottom-[6%] flex flex-col items-center">
        <div className="h-4 w-[72%] rounded-[100%] bg-[radial-gradient(ellipse_at_center,hsl(0_0%_10%/0.45),hsl(0_0%_10%/0.08)_55%,transparent_72%)] blur-[1px]" />
        <div className="-mt-1 h-7 w-[86%] rounded-[100%] bg-gradient-to-b from-[hsl(351_77%_70%/0.55)] via-[hsl(0_0%_10%/0.35)] to-transparent shadow-[0_18px_40px_-20px_hsl(349_74%_30%/0.55)]" />
        <div className="-mt-1 h-3 w-[64%] rounded-[100%] bg-[radial-gradient(ellipse_at_center,hsl(350_73%_44%/0.35),transparent_70%)] blur-md" />
      </div>

      {/* Central Mandanda Space mark */}
      <div className="absolute left-1/2 top-[38%] z-10 -translate-x-1/2 -translate-y-1/2">
        <div className="volt-float relative">
          <div className="absolute -inset-6 rounded-full bg-[radial-gradient(circle,hsl(350_73%_44%/0.35),transparent_68%)] blur-md" />
          <div className="relative grid h-[9.5rem] w-[9.5rem] place-items-center rounded-[2rem] bg-gradient-to-br from-volt via-[hsl(350_73%_44%)] to-[hsl(351_77%_61%)] text-volt-foreground shadow-[0_28px_60px_-24px_hsl(349_74%_28%/0.75)] sm:h-44 sm:w-44 sm:rounded-[2.25rem]">
            <div className="absolute inset-[10px] rounded-[1.55rem] border border-white/35 sm:inset-3 sm:rounded-[1.75rem]" />
            <div className="absolute inset-[18px] rounded-[1.35rem] bg-gradient-to-br from-white/25 via-transparent to-black/10 sm:inset-5 sm:rounded-[1.5rem]" />
            <div className="relative flex flex-col items-center gap-1.5 px-3 text-center">
              <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl bg-white shadow-lg sm:h-16 sm:w-16">
                <Image
                  src={BRAND_ICON_3D}
                  alt=""
                  width={56}
                  height={56}
                  className="h-[85%] w-[85%] object-contain"
                  priority
                />
              </span>
              <span className="text-xs font-bold tracking-wide sm:text-sm">Mandanda</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-volt-foreground/75">
                Space
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating chips + orbs — independent gentle float, not a carousel */}
      {FLOATERS.map((item, i) => {
        if (item.kind === "orb") {
          return (
            <span
              key={`orb-${i}`}
              className={cn(
                "volt-bob absolute z-[5] rounded-full shadow-md ring-2 ring-background/80",
                item.className,
                item.tone,
              )}
              style={{ animationDelay: item.delay }}
            />
          );
        }

        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className={cn("volt-bob absolute z-20", item.className)}
            style={{ animationDelay: item.delay }}
          >
            <div
              className={cn(
                "grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br shadow-[0_12px_28px_-14px_rgba(0,0,0,0.45)] ring-[3px] ring-background sm:h-[3.25rem] sm:w-[3.25rem]",
                item.tone,
              )}
              title={item.label}
            >
              <Icon className="h-5 w-5 sm:h-[1.35rem] sm:w-[1.35rem]" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
