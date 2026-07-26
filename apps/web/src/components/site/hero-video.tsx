"use client";

import { useState } from "react";
import { Play } from "lucide-react";

const YOUTUBE_ID = "xHU5MHuUSKI";

/** Loaded only after the member taps play — avoids YouTube script noise on first paint. */
const EMBED_SRC =
  `https://www.youtube-nocookie.com/embed/${YOUTUBE_ID}` +
  `?autoplay=1&mute=0&rel=0&modestbranding=1&playsinline=1` +
  `&iv_load_policy=3`;

const POSTER_SRC = `https://i.ytimg.com/vi/${YOUTUBE_ID}/hqdefault.jpg`;

export function HeroVideo() {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="relative mx-auto w-full min-w-0 max-w-full overflow-hidden px-1 sm:px-2 lg:max-w-none">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[2rem] bg-gradient-to-br from-volt/35 via-volt/10 to-ink/20 opacity-90 blur-xl sm:blur-2xl"
      />

      <div className="relative w-full max-w-full overflow-hidden rounded-[1.35rem] bg-gradient-to-br from-volt via-volt-hover to-ink p-[2px] shadow-[0_28px_60px_-28px_hsl(var(--volt)/0.45)] sm:rounded-[2rem]">
        <div className="relative w-full max-w-full overflow-hidden rounded-[calc(1.35rem-2px)] bg-ink sm:rounded-[calc(2rem-2px)]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent"
          />

          <span
            aria-hidden
            className="pointer-events-none absolute left-3 top-3 z-20 h-4 w-4 rounded-tl-lg border-l-2 border-t-2 border-volt/80 sm:left-4 sm:top-4 sm:h-5 sm:w-5"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute right-3 top-3 z-20 h-4 w-4 rounded-tr-lg border-r-2 border-t-2 border-white/40 sm:right-4 sm:top-4 sm:h-5 sm:w-5"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-3 left-3 z-20 h-4 w-4 rounded-bl-lg border-b-2 border-l-2 border-white/35 sm:bottom-4 sm:left-4 sm:h-5 sm:w-5"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-3 right-3 z-20 h-4 w-4 rounded-br-lg border-b-2 border-r-2 border-volt/70 sm:bottom-4 sm:right-4 sm:h-5 sm:w-5"
          />

          <div className="relative aspect-video w-full max-w-full overflow-hidden">
            {playing ? (
              <iframe
                title="Volt Trades intro"
                src={EMBED_SRC}
                allow="autoplay; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="absolute inset-0 h-full w-full border-0"
              />
            ) : (
              <button
                type="button"
                onClick={() => setPlaying(true)}
                className="group absolute inset-0 w-full"
                aria-label="Play Volt Trades intro video"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={POSTER_SRC}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/25 to-ink/30"
                />
                <span className="absolute inset-0 grid place-items-center">
                  <span className="grid h-16 w-16 place-items-center rounded-full bg-volt text-volt-foreground shadow-[0_16px_40px_-12px_hsl(var(--volt)/0.8)] ring-4 ring-white/20 transition-transform duration-300 group-hover:scale-110 sm:h-[4.5rem] sm:w-[4.5rem]">
                    <Play className="h-7 w-7 translate-x-0.5" fill="currentColor" aria-hidden />
                  </span>
                </span>
              </button>
            )}

            {!playing ? (
              <>
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,hsl(220_20%_8%/0.45)_100%)]"
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-ink/55 to-transparent sm:h-16"
                />
              </>
            ) : null}
          </div>

          <div className="relative flex min-w-0 items-center justify-between gap-2 border-t border-white/10 bg-gradient-to-r from-[hsl(0_0%_10%)] via-[hsl(0_0%_12%)] to-[hsl(350_30%_14%)] px-3 py-2.5 sm:gap-3 sm:px-5 sm:py-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold tracking-wide text-white/90">
                Volt Trades
              </p>
              <p className="truncate text-[11px] text-white/50">Learn · Invest · Build</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-volt/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-volt">
              {playing ? (
                <>
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-volt opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-volt" />
                  </span>
                  Playing
                </>
              ) : (
                "Watch intro"
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
