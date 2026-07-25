"use client";

const YOUTUBE_ID = "xHU5MHuUSKI";

/** Autoplay + loop + muted; chrome minimized. Mute is required for browser autoplay. */
const EMBED_SRC =
  `https://www.youtube-nocookie.com/embed/${YOUTUBE_ID}` +
  `?autoplay=1&mute=1&loop=1&playlist=${YOUTUBE_ID}` +
  `&controls=0&modestbranding=1&rel=0&playsinline=1` +
  `&iv_load_policy=3&disablekb=1&fs=0&cc_load_policy=0`;

export function HeroVideo() {
  return (
    <div className="relative mx-auto w-full min-w-0 max-w-full overflow-hidden px-1 sm:px-2 lg:max-w-none">
      {/* Soft ambient glow — contained so it cannot widen the page */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[2rem] bg-gradient-to-br from-volt/35 via-volt/10 to-ink/20 opacity-90 blur-xl sm:blur-2xl"
      />

      {/* Frame shell */}
      <div className="relative w-full max-w-full overflow-hidden rounded-[1.35rem] bg-gradient-to-br from-volt via-volt-hover to-ink p-[2px] shadow-[0_28px_60px_-28px_hsl(var(--volt)/0.45)] sm:rounded-[2rem]">
        <div className="relative w-full max-w-full overflow-hidden rounded-[calc(1.35rem-2px)] bg-ink sm:rounded-[calc(2rem-2px)]">
          {/* Top edge accent */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent"
          />

          {/* Corner ticks */}
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

          {/* Video stage — slight scale crops YouTube chrome */}
          <div className="relative aspect-video w-full max-w-full overflow-hidden">
            <iframe
              title="Volt Trades intro"
              src={EMBED_SRC}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen={false}
              loading="eager"
              referrerPolicy="strict-origin-when-cross-origin"
              className="pointer-events-none absolute left-1/2 top-1/2 h-[115%] w-[115%] max-w-none -translate-x-1/2 -translate-y-1/2 border-0"
            />

            {/* Soft vignette so edges feel designed, not raw player */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,hsl(220_20%_8%/0.45)_100%)]"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-ink/55 to-transparent sm:h-16"
            />
          </div>

          {/* Bottom caption bar */}
          <div className="relative flex min-w-0 items-center justify-between gap-2 border-t border-white/10 bg-gradient-to-r from-[hsl(0_0%_10%)] via-[hsl(0_0%_12%)] to-[hsl(350_30%_14%)] px-3 py-2.5 sm:gap-3 sm:px-5 sm:py-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold tracking-wide text-white/90">
                Volt Trades
              </p>
              <p className="truncate text-[11px] text-white/50">Learn · Invest · Build</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-volt/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-volt">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-volt opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-volt" />
              </span>
              Live
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
