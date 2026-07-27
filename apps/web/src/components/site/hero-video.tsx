"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Volume2, VolumeX } from "lucide-react";

const DEFAULT_YOUTUBE_ID = "nMzMlm-F_yA";

/** Minimal YouTube IFrame API surface (avoids adding @types/youtube). */
type YtPlayer = {
  playVideo: () => void;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  setVolume: (n: number) => void;
  getPlayerState: () => number;
  destroy: () => void;
};

type YtNamespace = {
  Player: new (
    el: HTMLElement | string,
    opts: Record<string, unknown>,
  ) => YtPlayer;
  PlayerState: { PLAYING: number; PAUSED: number; CUED: number; ENDED: number };
};

declare global {
  interface Window {
    YT?: YtNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

function loadYouTubeApi(): Promise<YtNamespace> {
  return new Promise((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }

    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      try {
        prev?.();
      } catch {
        // ignore previous handler errors
      }
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("YouTube API missing Player"));
    };

    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.async = true;
      document.head.appendChild(tag);
    }

    // Poll in case the script was already loading
    const started = Date.now();
    const tick = window.setInterval(() => {
      if (window.YT?.Player) {
        window.clearInterval(tick);
        resolve(window.YT);
      } else if (Date.now() - started > 12_000) {
        window.clearInterval(tick);
        reject(new Error("YouTube API timeout"));
      }
    }, 50);
  });
}

/**
 * Hero intro video — autoplay first, sound second.
 *
 * Browsers (mobile + many desktop) block unmuted autoplay. We always start
 * muted so playback begins without a Play tap; sound turns on after the first
 * user gesture (or via the mute button). Never remount the iframe on mute —
 * remounting is what forced users to press Play again.
 */
export function HeroVideo({ youtubeId = DEFAULT_YOUTUBE_ID }: { youtubeId?: string }) {
  const id = youtubeId.trim() || DEFAULT_YOUTUBE_ID;
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YtPlayer | null>(null);
  const userChoseMute = useRef(false);
  const soundUnlocked = useRef(false);

  const [muted, setMuted] = useState(true);
  const [needsTap, setNeedsTap] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let player: YtPlayer | null = null;
    let retryTimer: number | undefined;
    let watchTimer: number | undefined;

    const tryPlay = () => {
      const p = playerRef.current;
      if (!p) return;
      try {
        p.mute();
        p.playVideo();
      } catch {
        // ignore
      }
    };

    const unlockSound = () => {
      const p = playerRef.current;
      if (!p) return;

      // Always nudge playback on gesture (covers strict mobile policies).
      tryPlay();

      if (userChoseMute.current || soundUnlocked.current) {
        setNeedsTap(false);
        return;
      }

      try {
        p.unMute();
        p.setVolume(100);
        soundUnlocked.current = true;
        setMuted(false);
        setNeedsTap(false);
        window.removeEventListener("pointerdown", unlockSound);
        window.removeEventListener("touchstart", unlockSound);
        window.removeEventListener("keydown", unlockSound);
      } catch {
        setNeedsTap(true);
      }
    };

    async function boot() {
      const host = hostRef.current;
      if (!host) return;

      let YT: YtNamespace;
      try {
        YT = await loadYouTubeApi();
      } catch {
        if (!cancelled) setNeedsTap(true);
        return;
      }
      if (cancelled || !hostRef.current) return;

      // Empty mount node — YT replaces it with an iframe.
      hostRef.current.replaceChildren();
      const mount = document.createElement("div");
      mount.className = "h-full w-full";
      hostRef.current.appendChild(mount);

      player = new YT.Player(mount, {
        videoId: id,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          loop: 1,
          playlist: id,
          iv_load_policy: 3,
          disablekb: 1,
          fs: 0,
          cc_load_policy: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: (e: { target: YtPlayer }) => {
            if (cancelled) return;
            playerRef.current = e.target;
            e.target.mute();
            e.target.playVideo();

            // Retry if the first autoplay attempt was deferred.
            retryTimer = window.setTimeout(() => {
              tryPlay();
              try {
                const state = e.target.getPlayerState();
                if (state !== YT.PlayerState.PLAYING) setNeedsTap(true);
              } catch {
                setNeedsTap(true);
              }
            }, 900);

            watchTimer = window.setInterval(() => {
              try {
                if (e.target.getPlayerState() === YT.PlayerState.PLAYING) {
                  setNeedsTap(false);
                }
              } catch {
                // ignore
              }
            }, 1500);
          },
          onStateChange: (e: { data: number; target: YtPlayer }) => {
            if (cancelled) return;
            if (e.data === YT.PlayerState.PLAYING) {
              setNeedsTap(false);
            }
            if (e.data === YT.PlayerState.ENDED) {
              e.target.playVideo();
            }
            // Stuck on cue — nudge muted play a few times (don't fight forever).
            if (e.data === YT.PlayerState.CUED) {
              window.setTimeout(tryPlay, 250);
            }
          },
          onError: () => {
            if (!cancelled) setNeedsTap(true);
          },
        },
      });
      playerRef.current = player;
    }

    void boot();

    // First gesture: ensure playing + turn sound on (user preference).
    window.addEventListener("pointerdown", unlockSound, { passive: true });
    window.addEventListener("touchstart", unlockSound, { passive: true });
    window.addEventListener("keydown", unlockSound);

    return () => {
      cancelled = true;
      window.removeEventListener("pointerdown", unlockSound);
      window.removeEventListener("touchstart", unlockSound);
      window.removeEventListener("keydown", unlockSound);
      if (retryTimer) window.clearTimeout(retryTimer);
      if (watchTimer) window.clearInterval(watchTimer);
      try {
        player?.destroy();
      } catch {
        // ignore
      }
      playerRef.current = null;
    };
  }, [id]);

  const toggleMute = () => {
    const p = playerRef.current;
    if (!p) return;
    try {
      p.playVideo();
      if (muted) {
        p.unMute();
        p.setVolume(100);
        userChoseMute.current = false;
        soundUnlocked.current = true;
        setMuted(false);
      } else {
        p.mute();
        userChoseMute.current = true;
        setMuted(true);
      }
      setNeedsTap(false);
    } catch {
      setNeedsTap(true);
    }
  };

  const tapToPlay = () => {
    const p = playerRef.current;
    if (!p) return;
    try {
      p.mute();
      p.playVideo();
      if (!userChoseMute.current) {
        p.unMute();
        p.setVolume(100);
        soundUnlocked.current = true;
        setMuted(false);
      }
      setNeedsTap(false);
    } catch {
      // keep overlay
    }
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
            <div
              ref={hostRef}
              className="absolute left-1/2 top-1/2 h-[115%] w-[115%] max-w-none -translate-x-1/2 -translate-y-1/2 [&_iframe]:h-full [&_iframe]:w-full [&_iframe]:border-0"
            />

            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,hsl(220_20%_8%/0.45)_100%)]"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-ink/55 to-transparent sm:h-16"
            />

            {needsTap ? (
              <button
                type="button"
                onClick={tapToPlay}
                className="absolute inset-0 z-30 flex items-center justify-center bg-ink/35 backdrop-blur-[1px]"
                aria-label="Play video"
              >
                <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-ink/85 px-5 py-3 text-sm font-semibold text-white shadow-xl">
                  <Play className="h-4 w-4 fill-current text-volt" aria-hidden />
                  Tap to play
                </span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={toggleMute}
              className="absolute bottom-3 right-3 z-40 inline-flex items-center gap-2 rounded-full border border-white/20 bg-ink/80 px-3 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur transition hover:bg-ink sm:bottom-4 sm:right-4"
              aria-label={muted ? "Turn sound on" : "Mute video"}
            >
              {muted ? (
                <>
                  <VolumeX className="h-4 w-4 text-volt" aria-hidden />
                  Sound off
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
