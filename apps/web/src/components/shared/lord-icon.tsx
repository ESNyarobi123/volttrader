"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Lordicon player — load once per page. */
export function LordIconScript() {
  return <Script src="https://cdn.lordicon.com/lordicon.js" strategy="afterInteractive" />;
}

type LordIconProps = {
  src: string;
  trigger?: "hover" | "click" | "loop" | "loop-on-hover" | "in" | "morph";
  colors?: string;
  size?: number;
  className?: string;
  /** CSS selector — animate when hovering a parent button */
  target?: string;
};

/**
 * Animated Lordicon (wired/flat style via CDN).
 * @see https://lordicon.com/docs/web
 */
export function LordIcon({
  src,
  trigger = "hover",
  colors = "primary:#ffffff,secondary:#ffffff",
  size = 24,
  className,
  target,
}: LordIconProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Custom element registers after the CDN script loads
    if (typeof window !== "undefined" && customElements.get("lord-icon")) {
      setReady(true);
      return;
    }
    const t = window.setInterval(() => {
      if (customElements.get("lord-icon")) {
        setReady(true);
        window.clearInterval(t);
      }
    }, 50);
    return () => window.clearInterval(t);
  }, []);

  return (
    <span
      className={cn("inline-grid place-items-center leading-none", className)}
      style={{ width: size, height: size }}
    >
      {ready ? (
        // lord-icon is registered by https://cdn.lordicon.com/lordicon.js
        <span
          dangerouslySetInnerHTML={{
            __html: `<lord-icon src="${src}" trigger="${trigger}" colors="${colors}"${
              target ? ` target="${target}"` : ""
            } style="width:${size}px;height:${size}px"></lord-icon>`,
          }}
        />
      ) : (
        <span
          aria-hidden
          className="block rounded-full bg-white/50"
          style={{ width: size * 0.45, height: size * 0.45 }}
        />
      )}
    </span>
  );
}

/** Notification bell — Lordicon system regular 46 */
export const LORDICON_BELL = "https://cdn.lordicon.com/vspbqszr.json";
