"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

const DEFAULT_YOUTUBE_ID = "nMzMlm-F_yA";

function prefersMobileAutoplayMute() {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  const mobileUa = /iPhone|iPad|iPod|Android/i.test(ua);
  const coarse = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  // iOS / Android browsers block unmuted autoplay; mute first so the video still starts.
  return mobileUa || coarse;
}

function embedSrc(youtubeId: string, muted: boolean) {
  const origin =
    typeof window !== "undefined" ? encodeURIComponent(window.location.origin) : "";
  return (
    `https://www.youtube-nocookie.com/embed/${youtubeId}` +
    `?autoplay=1&mute=${muted ? 1 : 0}&loop=1&playlist=${youtubeId}` +
    `&controls=0&modestbranding=1&rel=0&playsinline=1` +
    `&iv_load_policy=3&disablekb=1&fs=0&cc_load_policy=0` +
    `&enablejsapi=1${origin ? `&origin=${origin}` : ""}`
  );
}

/**
 * Hero intro video.
 * - Desktop: sound ON by default (unmuted autoplay usually allowed).
 * - Mobile: muted autoplay first (browser policy), then sound turns ON on the
 *   first tap/scroll/key — unless the user already muted intentionally.
 */
export function HeroVideo({ youtubeId = DEFAULT_YOUTUBE_ID }: { youtubeId?: string }) {
  const id = youtubeId.trim() || DEFAULT_YOUTUBE_ID;
  const [muted, setMuted] = useState(false);
  const userChoseMute = useRef(false);
  const autoUnmuted = useRef(false);
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    if (!prefersMobileAutoplayMute()) {
      // Desktop / large screens — keep sound on.
      setMuted(false);
      return;
    }

    // Mobile: start muted so autoplay is allowed, then enable sound on first gesture.
    setMuted(true);

    const enableSound = () => {
      if (autoUnmuted.current || userChoseMute.current) return;
      autoUnmuted.current = true;
      setMuted(false);
      remove();
    };

    const remove = () => {
      window.removeEventListener("pointerdown", enableSound);
      window.removeEventListener("touchstart", enableSound);
      window.removeEventListener("keydown", enableSound);
      window.removeEventListener("scroll", enableSound, true);
    };

    window.addEventListener("pointerdown", enableSound, { once: true, passive: true });
    window.addEventListener("touchstart", enableSound, { once: true, passive: true });
    window.addEventListener("keydown", enableSound, { once: true });
    window.addEventListener("scroll", enableSound, { once: true, passive: true, capture: true });

    return remove;
  }, []);

  const toggleMute = () => {
    setMuted((prev) => {
      const next = !prev;
      // If user turns sound off, don't auto-unmute again.
      userChoseMute.current = next;
      if (!next) autoUnmuted.current = true;
      return next;
    });
  };

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
            <iframe
              key={`${id}-${muted ? "m" : "u"}`}
              title="Mandanda Space intro"
              src={embedSrc(id, muted)}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen={false}
              loading="eager"
              referrerPolicy="strict-origin-when-cross-origin"
              className="pointer-events-none absolute left-1/2 top-1/2 h-[115%] w-[115%] max-w-none -translate-x-1/2 -translate-y-1/2 border-0"
            />

            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,hsl(220_20%_8%/0.45)_100%)]"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-ink/55 to-transparent sm:h-16"
            />

            <button
              type="button"
              onClick={toggleMute}
              className="absolute bottom-3 right-3 z-30 inline-flex items-center gap-2 rounded-full border border-white/20 bg-ink/80 px-3 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur transition hover:bg-ink sm:bottom-4 sm:right-4"
              aria-label={muted ? "Turn sound on" : "Mute video"}
            >
              {muted ? (
                <>
                  <VolumeX className="h-4 w-4 text-volt" aria-hidden />
                  Sound off · tap on
                </>
              ) : (
                <>
                  <Volume2 className="h-4 w-4 text-volt" aria-hidden />
                  Sound on
                </>
              )}
            </button>
          </div>

          <div className="relative flex min-w-0 items-center justify-between gap-2 border-t border-white/10 bg-gradient-to-r from-[hsl(0_0%_10%)] via-[hsl(0_0%_12%)] to-[hsl(350_30%_14%)] px-3 py-2.5 sm:gap-3 sm:px-5 sm:py-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold tracking-wide text-white/90">
                Mandanda Space
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
