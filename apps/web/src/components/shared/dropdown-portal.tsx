"use client";

import {
  useEffect,
  useLayoutEffect,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/** Renders a dropdown in document.body so fixed headers/menus never clip it. */
export function DropdownPortal({
  open,
  anchorRef,
  children,
  className,
  align = "right",
  width,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  className?: string;
  align?: "left" | "right";
  /** Optional max/min width hint for positioning clamp */
  width?: number;
}) {
  const [mounted, setMounted] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;

    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const gap = 8;
      const w = width ?? 320;
      const next: CSSProperties = {
        position: "fixed",
        top: Math.min(r.bottom + gap, window.innerHeight - 16),
        zIndex: 200,
      };
      if (align === "right") {
        next.right = Math.max(8, window.innerWidth - r.right);
        next.left = "auto";
      } else {
        next.left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
        next.right = "auto";
      }
      setStyle(next);
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchorRef, align, width]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      data-dropdown-portal
      style={style}
      className={cn("pointer-events-auto", className)}
    >
      {children}
    </div>,
    document.body,
  );
}
