"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Image as ImageIcon, Film, ScanSearch, BookOpen, ShieldCheck, Moon, Sun, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/provenance", label: "Provenance", icon: ShieldCheck },
  { href: "/image", label: "Image", icon: ImageIcon },
  { href: "/video", label: "Video", icon: Film },
  { href: "/metadata", label: "Metadata", icon: ScanSearch },
  { href: "/docs", label: "Docs", icon: BookOpen },
  { href: "/privacy", label: "Privacy", icon: ShieldCheck },
];

export function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    const current = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(current);
  }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (next === "light") {
      document.documentElement.dataset.theme = "light";
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    try {
      localStorage.setItem("mediascrub-theme", next);
    } catch {
      /* private mode */
    }
  };
  return { theme, toggle };
}

export default function SiteHeader() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);

  // Route links close the mobile menu when selected.

  return (
    <header className="sticky top-0 z-50 border-b border-ink/8 bg-void/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="MediaScrub home">
          <span className="grid size-8 place-items-center rounded-lg bg-acid text-void transition-transform duration-300 group-hover:rotate-[-8deg]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <rect x="1.5" y="1.5" width="13" height="13" rx="3" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="8" cy="8" r="2.6" fill="currentColor" />
            </svg>
          </span>
          <span className="font-display text-lg font-bold tracking-tight">MediaScrub</span>
          <span className="kicker hidden lg:inline">{"// "}on-device</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition-colors",
                  active ? "bg-panel2 text-ink" : "text-dim hover:text-ink"
                )}
              >
                <Icon className="size-3.5" strokeWidth={active ? 2.4 : 2} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <span className="kicker hidden items-center gap-2 rounded-full border border-ink/10 px-3 py-1.5 sm:flex">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-acid opacity-60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-acid" />
            </span>
            0 uploads
          </span>
          <button
            onClick={toggle}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="grid size-9 place-items-center rounded-full border border-ink/10 text-dim transition-colors hover:text-ink"
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <button
            className="grid size-9 place-items-center rounded-full border border-ink/10 text-dim md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-ink/8 bg-void px-5 py-3 md:hidden" aria-label="Mobile">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm",
                  active ? "bg-panel2 text-ink" : "text-dim"
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
