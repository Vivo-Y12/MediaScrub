import type { Metadata } from "next";
import { CheckCircle2, Database, Eye, FileQuestion, Globe, ServerOff, ShieldCheck, XCircle } from "lucide-react";
import Reveal from "@/components/reveal";

export const metadata: Metadata = {
  title: "Privacy architecture",
  description:
    "How MediaScrub processes media locally without uploading it to a media-processing server.",
};

const NEVER = [
  "Your images or videos — MediaScrub has no endpoint that accepts media",
  "File names, thumbnails, dimensions, or any derived data",
  "Account identifiers — accounts don't exist",
  "Analytics beacons, fingerprinting, or ad-tech pixels",
  "Cookies of any kind",
];

const SOMETIMES = [
  { what: "Static page assets", why: "HTML/CSS/JS/WASM — how any website loads", when: "on page load" },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
      <Reveal>
        <p className="kicker">{"// "}privacy architecture</p>
        <h1 className="font-display mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
          Designed so we <span className="text-acid">couldn&apos;t</span> see your files if we tried.
        </h1>
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-dim sm:text-base">
          Policies can be rewritten. Architecture can&apos;t be — not without shipping you new code.
          So instead of asking for trust, MediaScrub removes the capability.
        </p>
      </Reveal>

      <div className="mt-14 grid gap-6 lg:grid-cols-2">
        <Reveal delay={0.06}>
          <div className="card-line h-full rounded-3xl bg-panel p-7">
            <h2 className="flex items-center gap-2.5 text-lg font-semibold">
              <XCircle className="size-5 text-danger" /> Never sent, never stored
            </h2>
            <ul className="mt-5 space-y-3">
              {NEVER.map((n) => (
                <li key={n} className="flex gap-3 text-sm leading-relaxed text-dim">
                  <XCircle className="mt-0.5 size-4 shrink-0 text-danger/70" />
                  {n}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
        <Reveal delay={0.12}>
          <div className="card-line h-full rounded-3xl bg-panel p-7">
            <h2 className="flex items-center gap-2.5 text-lg font-semibold">
              <CheckCircle2 className="size-5 text-acid" /> The complete server surface
            </h2>
            <ul className="mt-5 space-y-4">
              {SOMETIMES.map((s) => (
                <li key={s.what} className="rounded-xl border border-ink/10 bg-panel2 p-4">
                  <p className="text-sm font-medium">{s.what}</p>
                  <p className="mt-1 text-[0.8rem] text-dim">{s.why}</p>
                  <p className="mt-1.5 font-mono text-[0.62rem] uppercase tracking-wider text-faint">{s.when}</p>
                </li>
              ))}
            </ul>
            <p className="mt-5 flex gap-2 text-[0.78rem] leading-relaxed text-dim">
              <Database className="mt-0.5 size-4 shrink-0 text-acid/70" />
              No database is required for processing. No media, file names, or inspection results are saved by the application.
            </p>
          </div>
        </Reveal>
      </div>

      <Reveal delay={0.16}>
        <h2 className="font-display mt-16 text-2xl font-semibold">Verify it yourself — 60 seconds</h2>
        <ol className="mt-6 space-y-4">
          {[
            { icon: Eye, t: "Open DevTools → Network", d: "Filter by 'Media' or watch all requests. Process any file. The meter stays flat: zero bytes of media transmitted." },
            { icon: Globe, t: "Pull the plug", d: "First load the relevant engine by processing one file, then go offline within that tab. Initial WASM/worker loading needs same-origin GET requests; media is never uploaded." },
            { icon: ServerOff, t: "Inspect the pipeline", d: "Downloads come from blob: URLs created on-device. Sources are plain TypeScript — read them and trace every byte." },
            { icon: FileQuestion, t: "Check storage", d: "Application → Storage: no cookies, no caches of your media, nothing in IndexedDB. The only localStorage key is your theme preference." },
          ].map((s, i) => (
            <li key={s.t} className="card-line flex gap-4 rounded-2xl bg-panel p-5">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-panel2 font-mono text-xs text-acid">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <s.icon className="size-4 text-acid" /> {s.t}
                </p>
                <p className="mt-1 text-[0.82rem] leading-relaxed text-dim">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </Reveal>

      <Reveal delay={0.2}>
        <div className="mt-16 rounded-3xl border border-acid/25 bg-acid/[0.05] p-8">
          <h2 className="flex items-center gap-2.5 text-lg font-semibold">
            <ShieldCheck className="size-5 text-acid" /> Threat model shortlist
          </h2>
          <div className="mt-4 grid gap-3 text-[0.82rem] leading-relaxed text-dim md:grid-cols-2">
            <p>· <span className="text-ink">Server compromise:</span> attacker finds no stored user media. A disabled legacy counter endpoint remains for compatibility.</p>
            <p>· <span className="text-ink">Network observer:</span> sees you loaded a website. Media processing generates no traffic to observe.</p>
            <p>· <span className="text-ink">Shared device:</span> outputs live in your downloads folder — as private as anything else you download.</p>
            <p>· <span className="text-ink">Malicious update:</span> the residual risk of any web app. Pin the issue by keeping offline copies of critical outputs.</p>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
