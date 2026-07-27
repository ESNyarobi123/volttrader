import Link from "next/link";
import { ArrowUpRight, Mail } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Platform",
    links: [
      { href: "/learn", label: "Learn Forex" },
      { href: "/trading-floor", label: "Account Management" },
      { href: "/projects", label: "Projects" },
      { href: "/volt-society", label: "Volt Society" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/blog", label: "Blog" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/register", label: "Sign up" },
      { href: "/login", label: "Sign in" },
      { href: "/dashboard", label: "Dashboard" },
      { href: "/dashboard/wallet", label: "Wallet" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
      { href: "/risk-disclosure", label: "Risk disclosure" },
      { href: "/refund-policy", label: "Refund policy" },
    ],
  },
];

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-8 overflow-hidden bg-ink-deep text-white">
      {/* Crimson accents on deep black */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_55%_at_10%_0%,hsl(350_73%_44%/0.22),transparent_55%),radial-gradient(55%_45%_at_95%_100%,hsl(350_73%_44%/0.1),transparent_50%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-volt/50 to-transparent"
      />

      <div className="container-page relative">
        {/* CTA band */}
        <div className="flex flex-col items-start justify-between gap-6 border-b border-white/10 py-12 md:flex-row md:items-center md:py-14">
          <div className="max-w-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-volt-light">
              LEARN · INVEST · BUILD
            </p>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-white md:text-3xl">
              Ready to grow with Mandanda Space?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/60 md:text-base">
              Education, wallet, and curated opportunities — one clear ecosystem.
            </p>
          </div>
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <Link
              href="/register"
              className={cn(
                buttonVariants({ variant: "primary", size: "lg" }),
                "rounded-full px-7 shadow-volt",
              )}
            >
              Sign up free
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/contact"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "rounded-full border-white/20 bg-white px-7 text-ink hover:bg-white/90",
              )}
            >
              <Mail className="h-4 w-4" aria-hidden />
              Contact us
            </Link>
          </div>
        </div>

        {/* Brand + link columns */}
        <div className="grid gap-10 py-12 md:grid-cols-[1.35fr_repeat(4,1fr)] md:gap-8 lg:gap-10">
          <div className="max-w-sm space-y-4">
            <Logo className="text-white [&>span:last-child>span]:text-volt-light" />
            <p className="text-sm leading-relaxed text-white/60">
              Learn Forex. Manage capital. Explore opportunities. Build the future — with clarity
              outside and power inside.
            </p>
            <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-accent-mint">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-mint" aria-hidden />
              Online
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="group inline-flex items-center gap-1 text-sm text-white/65 transition-colors hover:text-white"
                    >
                      {link.label}
                      <ArrowUpRight
                        className="h-3 w-3 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-70"
                        aria-hidden
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col gap-3 border-t border-white/10 py-6 text-[11px] leading-relaxed text-white/45 md:flex-row md:items-center md:justify-between md:gap-6">
          <p>© {year} Mandanda Space. All rights reserved.</p>
          <p className="md:max-w-xl md:text-right">
            Trading and investing carry risk. Projections are targets, not guarantees. Not investment
            advice.{" "}
            <Link
              href="/risk-disclosure"
              className="font-medium text-white/70 underline decoration-white/20 underline-offset-2 transition-colors hover:text-white"
            >
              Risk disclosure
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
