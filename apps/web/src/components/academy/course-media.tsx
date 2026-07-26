"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import type { CourseLevel } from "@volt/config";
import { cn } from "@/lib/utils";
import { resolveStorageUrl } from "@/lib/format";

const LEVEL_WASH: Record<CourseLevel, string> = {
  BEGINNER: "from-volt/40 via-[hsl(350_73%_44%/0.18)] to-[hsl(0_0%_10%/0.22)]",
  INTERMEDIATE: "from-[hsl(0_0%_10%/0.4)] via-[hsl(349_74%_36%/0.16)] to-volt/20",
  ADVANCED: "from-[hsl(142_65%_29%/0.35)] via-surface-2 to-[hsl(0_0%_10%/0.18)]",
  PREMIUM: "from-[hsl(349_74%_36%/0.38)] via-[hsl(30_20%_20%/0.08)] to-volt/25",
};

const PLAY_TONE: Record<CourseLevel, string> = {
  BEGINNER:
    "bg-volt text-volt-foreground shadow-[0_12px_28px_-10px_hsl(350_73%_36%/0.75)]",
  INTERMEDIATE:
    "bg-[hsl(350_73%_44%)] text-white shadow-[0_12px_28px_-10px_hsl(349_74%_30%/0.7)]",
  ADVANCED:
    "bg-[hsl(162_55%_38%)] text-white shadow-[0_12px_28px_-10px_hsl(162_55%_30%/0.65)]",
  PREMIUM:
    "bg-gradient-to-br from-volt to-[hsl(349_74%_36%)] text-volt-foreground shadow-[0_12px_28px_-10px_hsl(349_74%_30%/0.7)]",
};

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Cinema-style 16:9 frame with play affordance — uses API thumbnail when available. */
export function CourseVideoFrame({
  level,
  title,
  durationMinutes,
  thumbnailUrl,
  index = 0,
  className,
}: {
  level: CourseLevel;
  title: string;
  durationMinutes: number;
  thumbnailUrl?: string | null;
  index?: number;
  className?: string;
}) {
  const src = resolveStorageUrl(thumbnailUrl);
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = Boolean(src) && !imgFailed;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[1.15rem] bg-[hsl(30_12%_12%)] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
        className,
      )}
    >
      {/* Top bezel / camera notch */}
      <div
        aria-hidden
        className="mb-1.5 flex items-center justify-center gap-1.5 pb-0.5"
      >
        <span className="h-1 w-1 rounded-full bg-white/20" />
        <span className="h-1 w-10 rounded-full bg-white/15" />
        <span className="h-1 w-1 rounded-full bg-white/20" />
      </div>

      <div className="relative aspect-video overflow-hidden rounded-[0.85rem] bg-black">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src!}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div
            className={cn(
              "absolute inset-0 bg-gradient-to-br transition-transform duration-500 group-hover:scale-[1.03]",
              LEVEL_WASH[level],
            )}
          >
            <svg
              viewBox="0 0 200 112"
              className="absolute inset-0 h-full w-full opacity-50"
              aria-hidden
            >
              <path
                d={
                  index % 2 === 0
                    ? "M0 78 C30 72, 42 40, 70 46 C98 52, 110 24, 140 30 C165 34, 180 50, 200 36"
                    : "M0 62 C34 88, 50 34, 78 44 C106 54, 120 18, 150 34 C170 44, 184 24, 200 38"
                }
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                className="text-foreground/30"
                strokeLinecap="round"
              />
              {[24, 48, 72, 96, 120, 144, 168].map((x, i) => (
                <rect
                  key={x}
                  x={x}
                  y={58 - ((i * 9 + index * 6) % 28)}
                  width="9"
                  height={22 + ((i * 7 + index * 4) % 24)}
                  rx="2"
                  className="fill-foreground/10"
                />
              ))}
            </svg>
            <span
              aria-hidden
              className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/15 blur-2xl"
            />
          </div>
        )}

        {/* Scrim */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-black/20"
        />

        {/* Play control */}
        <div className="absolute inset-0 grid place-items-center">
          <span
            className={cn(
              "grid h-14 w-14 place-items-center rounded-full ring-4 ring-white/20 transition-transform duration-300 group-hover:scale-110",
              PLAY_TONE[level],
            )}
          >
            <Play className="h-6 w-6 translate-x-0.5" fill="currentColor" aria-hidden />
          </span>
        </div>

        {/* HUD chips */}
        <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
          <span className="rounded-md bg-black/55 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/95 backdrop-blur-sm">
            Lesson preview
          </span>
        </div>
        <div className="absolute bottom-2.5 right-2.5 rounded-md bg-black/60 px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-white backdrop-blur-sm">
          {formatDuration(durationMinutes)}
        </div>
        <p className="absolute bottom-2.5 left-2.5 max-w-[65%] truncate text-[11px] font-medium text-white/90 drop-shadow">
          {title}
        </p>
      </div>

      {/* Bottom player chrome */}
      <div
        aria-hidden
        className="mt-1.5 flex items-center gap-2 px-1.5 pb-0.5 pt-0.5"
      >
        <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
          <span className="block h-full w-[18%] rounded-full bg-volt/80 transition-all duration-500 group-hover:w-[28%]" />
        </span>
        <span className="font-mono text-[9px] text-white/35">HD</span>
      </div>
    </div>
  );
}
