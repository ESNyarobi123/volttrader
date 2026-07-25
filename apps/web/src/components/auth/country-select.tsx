"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import {
  COUNTRIES,
  DEFAULT_COUNTRY_ISO,
  flagUrl,
  getCountry,
  type CountryOption,
} from "@/lib/countries";
import { cn } from "@/lib/utils";

function Flag({ iso2, className }: { iso2: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={flagUrl(iso2, 40)}
      alt=""
      width={20}
      height={15}
      loading="lazy"
      className={cn("h-3.5 w-5 rounded-[2px] object-cover shadow-sm", className)}
    />
  );
}

export function CountrySelect({
  value = DEFAULT_COUNTRY_ISO,
  onChange,
  id = "country",
  className,
}: {
  value?: string;
  onChange: (country: CountryOption) => void;
  id?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = getCountry(value) ?? getCountry(DEFAULT_COUNTRY_ISO)!;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.iso2.toLowerCase().includes(q) ||
        c.dial.includes(q),
    );
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        id={id}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex h-11 w-full items-center gap-2.5 rounded-xl border border-border/80 bg-background px-3 text-left text-sm",
          "transition-colors hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt",
        )}
      >
        <Flag iso2={selected.iso2} />
        <span className="min-w-0 flex-1 truncate font-medium">{selected.name}</span>
        <span className="text-xs text-muted-foreground">{selected.iso2}</span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-50 mt-1.5 overflow-hidden rounded-xl border border-border bg-surface shadow-lift">
          <div className="relative border-b border-border p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search country…"
              className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-volt"
            />
          </div>
          <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-sm text-muted-foreground">No countries found</li>
            ) : (
              filtered.map((c) => {
                const active = c.iso2 === selected.iso2;
                return (
                  <li key={c.iso2}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        onChange(c);
                        setOpen(false);
                        setQuery("");
                      }}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
                        active ? "bg-volt/10" : "hover:bg-surface-2",
                      )}
                    >
                      <Flag iso2={c.iso2} />
                      <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      <span className="text-xs text-muted-foreground">{c.dial}</span>
                      {active ? <Check className="h-3.5 w-3.5 text-volt-dim" /> : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** Dial-code picker used beside the phone input. */
export function DialCodeSelect({
  value = DEFAULT_COUNTRY_ISO,
  onChange,
  className,
}: {
  value?: string;
  onChange: (country: CountryOption) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = getCountry(value) ?? getCountry(DEFAULT_COUNTRY_ISO)!;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.iso2.toLowerCase().includes(q) ||
        c.dial.includes(q),
    );
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative shrink-0", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Select country code"
        className={cn(
          "flex h-11 items-center gap-1.5 rounded-xl border border-border/80 bg-background px-2.5 text-sm",
          "hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt",
        )}
      >
        <Flag iso2={selected.iso2} />
        <span className="font-medium tabular-nums">{selected.dial}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      </button>

      {open ? (
        <div className="absolute left-0 z-50 mt-1.5 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-surface shadow-lift">
          <div className="relative border-b border-border p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search code…"
              className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-volt"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.map((c) => {
              const active = c.iso2 === selected.iso2;
              return (
                <li key={c.iso2}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(c);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm",
                      active ? "bg-volt/10" : "hover:bg-surface-2",
                    )}
                  >
                    <Flag iso2={c.iso2} />
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    <span className="font-medium tabular-nums">{c.dial}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
