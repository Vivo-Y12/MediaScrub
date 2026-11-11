import Link from "next/link";
import { ShieldCheck, Cpu, Trash2 } from "lucide-react";

const COLS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Tools",
    links: [
      { href: "/provenance", label: "Provenance inspector" },
      { href: "/image", label: "Image studio" },
      { href: "/video", label: "Video lab" },
      { href: "/metadata", label: "Metadata inspector" },
    ],
  },
  {
    title: "Project",
    links: [
      { href: "/docs", label: "Formats & limits" },
      { href: "/privacy", label: "Privacy architecture" },
      { href: "/docs#faq", label: "FAQ" },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-ink/8">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="font-display text-2xl font-bold tracking-tight">MediaScrub</p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-dim">
              Free media tools that run where your files live — on your device. No accounts, no quotas,
              no uploads, nothing to sign up for.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {[
                { icon: ShieldCheck, label: "client-side by design" },
                { icon: Cpu, label: "WASM + workers" },
                { icon: Trash2, label: "zero retention" },
              ].map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 px-3 py-1 font-mono text-[0.65rem] uppercase tracking-wider text-dim"
                >
                  <Icon className="size-3" />
                  {label}
                </span>
              ))}
            </div>
          </div>
          {COLS.map((col) => (
            <div key={col.title}>
              <p className="kicker mb-4">{col.title}</p>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link href={l.href} className="text-sm text-dim transition-colors hover:text-ink">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="hairline-t mt-12 flex flex-wrap items-center justify-between gap-3 pt-6">
          <p className="font-mono text-[0.65rem] uppercase tracking-widest text-faint">
            MediaScrub · open · free · private
          </p>
          <p className="font-mono text-[0.65rem] uppercase tracking-widest text-faint">
            your files never leave this tab
          </p>
        </div>
      </div>
      <div
        aria-hidden
        className="pointer-events-none select-none whitespace-nowrap text-center font-display text-[16vw] font-bold leading-[0.75] tracking-tighter text-ink/[0.035]"
      >
        MediaScrub
      </div>
    </footer>
  );
}
