import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Ban,
  Braces,
  Cpu,
  Eye,
  Film,
  Gauge,
  Image as ImageIcon,
  KeyRound,
  Layers,
  Lock,
  Package,
  ScanSearch,
  ServerOff,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react";
import Reveal from "@/components/reveal";

const FORMATS_IN = ["PNG", "JPEG", "WEBP", "GIF", "BMP", "TIFF", "AVIF", "SVG", "MP4", "WEBM", "MOV", "MKV", "AVI", "3GP", "EXIF", "XMP", "GPS", "ICC"];

const STEPS = [
  {
    n: "01",
    icon: Layers,
    title: "Drop your media",
    body: "Images or videos land straight into browser memory via drag-and-drop. There is no upload stage — there is nothing to upload to.",
  },
  {
    n: "02",
    icon: Cpu,
    title: "On-device engines work",
    body: "Canvas + Web Workers crunch pixels; a 31 MB FFmpeg.wasm transcodes video. The main thread stays free, progress stays live, and cancel actually cancels.",
  },
  {
    n: "03",
    icon: Package,
    title: "Download & vanish",
    body: "Outputs stream to your disk one-by-one or as a ZIP. Object URLs are revoked, memory is released, and the server never kept anything to forget.",
  },
];

const HONEST = [
  { icon: Ban, title: "Codecs differ per browser", body: "WebP and AVIF encoding depend on your browser build. We probe capability live and grey out what your machine can't do." },
  { icon: Gauge, title: "Memory has a ceiling", body: "Video transcoding in WASM holds the file in RAM. We state size guidance per device and hard-stop beyond 2 GB instead of crashing your tab." },
  { icon: KeyRound, title: "No watermark-washing claims", body: "Metadata removal is real and verifiable. Pixel-level watermarks (SynthID) and C2PA provenance are different beasts — we don't claim to defeat or forge them." },
];

const FAQ = [
  {
    q: "Is anything uploaded to a server?",
    a: "No media, ever. The server delivers the page and same-origin processing engines. No file names, media or processing analytics are sent during jobs. Check your browser's network inspector while processing — you'll see zero media traffic.",
  },
  {
    q: "Which formats actually work?",
    a: "Images: PNG, JPEG, WebP, GIF (first frame), BMP, TIFF (first page), SVG (rasterized), AVIF where your browser supports it. Video: MP4, WebM, MOV, MKV and AVI containers decode through FFmpeg.wasm; H.264, VP8/VP9 and common audio codecs encode out. Exotic codecs fail with a clear error, not a silent wrong file.",
  },
  {
    q: "Does metadata removal strip AI watermarks too?",
    a: "No — and we won't pretend otherwise. EXIF/XMP removal erases camera, location, and app metadata, and that's verifiable with this same tool. Invisible pixel watermarks like Google SynthID are woven into image data and survive re-encoding; removing or detecting them is out of scope and out of our claims.",
  },
  {
    q: "Why is video slower than desktop apps?",
    a: "FFmpeg.wasm runs in a single-threaded WASM VM without GPU acceleration or SIMD-heavy builds in this configuration. Expect roughly 0.2–1× realtime. For quick clips (social, GIFs, thumbnails) it's genuinely convenient; for hour-long 4K files, a desktop FFmpeg is the right tool and we'll say so.",
  },
  {
    q: "What happens to my files when I close the tab?",
    a: "They never existed anywhere but your machine. Object URLs are revoked, worker memory is released, and there is no server-side copy to delete because one was never created.",
  },
  {
    q: "Is it really free? What's the catch?",
    a: "Free with no account, no quota, no watermark on outputs, no ads. The 'catch' is physics: your device does the work, so your CPU and RAM are the only limits.",
  },
];

export default function LandingPage() {
  return (
    <div className="relative overflow-hidden">
      {/* ————— HERO ————— */}
      <section className="relative">
        <div className="grid-bg pointer-events-none absolute inset-0" aria-hidden />
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2" aria-hidden>
          <div className="animate-aurora-a absolute left-0 top-0 h-[420px] w-[520px] rounded-full bg-acid/[0.13] blur-[110px]" />
          <div className="animate-aurora-b absolute right-0 top-16 h-[380px] w-[480px] rounded-full bg-mint/[0.09] blur-[110px]" />
        </div>
        <div className="noise pointer-events-none absolute inset-0" aria-hidden />

        <div className="relative mx-auto max-w-7xl px-5 pb-16 pt-20 sm:px-8 sm:pt-28">
          <Reveal>
            <p className="kicker flex items-center gap-3">
              <span className="inline-block size-1.5 animate-blink rounded-full bg-acid" />
              local-only media engine · v1.0
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="font-display mt-6 max-w-5xl text-[clamp(2.6rem,7.5vw,5.6rem)] font-bold leading-[0.98] tracking-[-0.03em]">
              Your media never
              <br />
              leaves <span className="text-stroke">this tab.</span>
              <span className="text-acid"> Never did.</span>
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-7 max-w-xl text-base leading-relaxed text-dim sm:text-lg">
              MediaScrub is a free, open media workbench that runs entirely in your browser — convert, compress,
              resize and inspect images and video with Web Workers, Canvas and WebAssembly.
              <span className="text-ink"> No accounts. No quotas. No uploads.</span>
            </p>
          </Reveal>
          <Reveal delay={0.24}>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/provenance" className="inline-flex items-center gap-2 rounded-full border border-acid/50 bg-acid/10 px-6 py-3.5 text-sm font-semibold text-acid hover:bg-acid/20"><ShieldCheck className="size-4" /> Inspect provenance</Link>
              <Link
                href="/image"
                className="group inline-flex items-center gap-2 rounded-full bg-acid px-6 py-3.5 text-sm font-semibold text-[#0a0b05] transition-all hover:shadow-[0_0_40px_-8px] hover:shadow-acid/70"
              >
                <ImageIcon className="size-4" />
                Open image studio
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/video"
                className="group inline-flex items-center gap-2 rounded-full border border-ink/15 px-6 py-3.5 text-sm transition-colors hover:border-ink/40"
              >
                <Film className="size-4" />
                Open video lab
              </Link>
              <Link
                href="/metadata"
                className="group inline-flex items-center gap-2 rounded-full border border-ink/15 px-6 py-3.5 text-sm transition-colors hover:border-ink/40"
              >
                <ScanSearch className="size-4" />
                Inspect metadata
              </Link>
            </div>
          </Reveal>
          <Reveal delay={0.32}>
            <div className="mt-12 flex flex-wrap gap-x-10 gap-y-4 border-t border-ink/8 pt-6 font-mono text-[0.65rem] uppercase tracking-widest text-faint">
              <span>
                <span className="text-acid">0</span> file analytics requests during processing
              </span>
              <span><span className="text-ink">0</span> bytes uploaded to any server</span>
              <span><span className="text-ink">0</span> accounts created, ever</span>
            </div>
          </Reveal>
        </div>

        {/* format marquee */}
        <div className="relative border-y border-ink/8 bg-panel/40 py-3.5" aria-hidden>
          <div className="flex overflow-hidden">
            <div className="animate-marquee flex shrink-0 items-center gap-8 pr-8">
              {[...FORMATS_IN, ...FORMATS_IN].map((f, i) => (
                <span key={i} className="flex items-center gap-8 font-mono text-xs uppercase tracking-[0.28em] text-faint">
                  {f}
                  <span className="size-1 rounded-full bg-acid/50" />
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pt-20 sm:px-8"><div className="card-line relative overflow-hidden rounded-3xl bg-panel p-8 sm:p-12"><div className="absolute -right-16 -top-24 size-72 rounded-full bg-acid/10 blur-[80px]" /><div className="relative"><p className="kicker">{"// "}provenance · on-device workspace</p><h2 className="font-display mt-4 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">Inspect provenance. Keep the original intact.</h2><p className="mt-4 max-w-2xl text-sm leading-relaxed text-dim">Verify embedded C2PA Content Credentials in your browser; explore manifests, validation findings and AI-origin assertions. No validated SynthID detector is available here, so we never claim a negative scan.</p><Link href="/provenance" className="mt-6 inline-flex items-center gap-2 rounded-full bg-acid px-5 py-3 text-sm font-semibold text-[#0a0b05]">Open inspector <ArrowRight className="size-4" /></Link></div></div></section>

      {/* ————— TOOLS ————— */}
      <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <Reveal>
          <p className="kicker">{"// "}the workbench</p>
          <h2 className="font-display mt-4 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            Four tools. Zero infrastructure between you and your files.
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            {
              href: "/image",
              icon: ImageIcon,
              kicker: "01 · image studio",
              title: "Convert, compress, resize — in bulk",
              chips: ["WebP · PNG · JPEG · AVIF", "TIFF & SVG decode", "batch + ZIP", "before/after compare", "EXIF stripped by default"],
            },
            {
              href: "/video",
              icon: Film,
              kicker: "02 · video lab",
              title: "A real FFmpeg, compiled to WASM",
              chips: ["MP4 · WebM transcode", "CRF compression", "GIF maker", "audio extraction", "frame thumbnails"],
            },
            {
              href: "/metadata",
              icon: ScanSearch,
              kicker: "03 · inspector",
              title: "See what your files confess",
              chips: ["EXIF / XMP / IPTC / ICC", "GPS pinpoint alerts", "clean-copy download", "JSON reports", "honest provenance notes"],
            },
          ].map((t, i) => (
            <Reveal key={t.href} delay={i * 0.08}>
              <Link
                href={t.href}
                className="group card-line relative flex h-full flex-col rounded-3xl bg-panel p-7 transition-all duration-300 hover:-translate-y-1 hover:border-acid/40 hover:shadow-[0_30px_60px_-30px] hover:shadow-acid/20"
              >
                <div className="flex items-start justify-between">
                  <span className="grid size-12 place-items-center rounded-2xl border border-ink/10 bg-panel2 text-acid transition-colors group-hover:border-acid/30">
                    <t.icon className="size-5" strokeWidth={1.7} />
                  </span>
                  <ArrowUpRight className="size-5 text-faint transition-all duration-300 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-acid" />
                </div>
                <p className="kicker mt-6">{t.kicker}</p>
                <h3 className="font-display mt-2 text-xl font-semibold leading-snug">{t.title}</h3>
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {t.chips.map((c) => (
                    <span key={c} className="rounded-full border border-ink/10 px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-wider text-dim">
                      {c}
                    </span>
                  ))}
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ————— HOW IT WORKS ————— */}
      <section className="border-y border-ink/8 bg-panel/30">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
          <Reveal>
            <p className="kicker">{"// "}how it works</p>
            <h2 className="font-display mt-4 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
              The pipeline that skips the server.
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-10 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 0.1}>
                <div className="relative">
                  <p className="font-display text-6xl font-bold text-ink/[0.07]">{s.n}</p>
                  <s.icon className="absolute left-0 top-8 size-5 text-acid" strokeWidth={1.7} />
                  <h3 className="font-display mt-8 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-dim">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ————— PRIVACY ARCHITECTURE ————— */}
      <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <Reveal>
            <div>
              <p className="kicker">{"// "}privacy architecture</p>
              <h2 className="font-display mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Privacy you can verify, not just believe.
              </h2>
              <p className="mt-5 text-sm leading-relaxed text-dim sm:text-base">
                Most &quot;private&quot; tools stream your files to a server and pinky-promise to delete them.
                MediaScrub inverts the model: the processing engines ship <em>to you</em> as JavaScript and WASM.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  { icon: ServerOff, t: "No media endpoints exist", d: "Only health and a disabled legacy counter route exist. Neither accepts media." },
                  { icon: Lock, t: "Sandboxed execution", d: "Workers and WASM run inside the browser sandbox. Media bytes never touch fetch/XHR/WebSocket code paths." },
                  { icon: Eye, t: "Auditable in one tab", d: "Open DevTools → Network. Process a file. Watch exactly zero bytes of media leave. That's the entire audit." },
                  { icon: ShieldCheck, t: "Automatic amnesia", d: "Object URLs revoked, WASM filesystem wiped, workers terminated. Close the tab and it's as if nothing happened." },
                ].map((x) => (
                  <li key={x.t} className="flex gap-4">
                    <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl border border-ink/10 bg-panel text-acid">
                      <x.icon className="size-4" strokeWidth={1.8} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{x.t}</p>
                      <p className="mt-1 text-[0.82rem] leading-relaxed text-dim">{x.d}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={0.12}>
            {/* data-flow diagram */}
            <div className="card-line relative overflow-hidden rounded-3xl bg-panel p-6 sm:p-8">
              <div className="noise pointer-events-none absolute inset-0" aria-hidden />
              <p className="kicker mb-6">data-flow · live diagram</p>
              <div className="relative space-y-4">
                <div className="rounded-xl border border-ink/10 bg-panel2 p-4">
                  <p className="font-mono text-[0.6rem] uppercase tracking-widest text-faint">input</p>
                  <p className="mt-1 text-sm font-medium">your-file.mov</p>
                </div>
                <div className="flex justify-center">
                  <div className="h-8 w-px bg-gradient-to-b from-acid/60 to-acid" />
                </div>
                <div className="rounded-xl border border-acid/30 bg-acid/[0.05] p-4">
                  <p className="font-mono text-[0.6rem] uppercase tracking-widest text-acid">your device · browser sandbox</p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {["canvas/worker", "ffmpeg.wasm", "exifr"].map((e) => (
                      <span key={e} className="rounded-lg border border-ink/10 bg-void/40 px-2 py-2 text-center font-mono text-[0.6rem] text-dim">
                        {e}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex justify-center">
                  <div className="h-8 w-px bg-gradient-to-b from-acid to-acid/60" />
                </div>
                <div className="rounded-xl border border-ink/10 bg-panel2 p-4">
                  <p className="font-mono text-[0.6rem] uppercase tracking-widest text-faint">output</p>
                  <p className="mt-1 text-sm font-medium">your-file.webm → downloads folder</p>
                </div>
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-ink/15 p-4 opacity-70">
                  <ServerOff className="size-5 shrink-0 text-danger" />
                  <p className="text-[0.75rem] leading-relaxed text-dim">
                    <span className="text-ink">server:</span> receives page/asset requests; no media uploads or processing analytics.
                    <span className="text-danger"> media path: not wired, not reachable.</span>
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ————— HONEST LIMITS ————— */}
      <section className="border-y border-ink/8 bg-panel/30">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
          <Reveal>
            <p className="kicker">{"// "}honesty, printed large</p>
            <h2 className="font-display mt-4 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
              What this can&apos;t do — said out loud, before you ask.
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {HONEST.map((h, i) => (
              <Reveal key={h.title} delay={i * 0.08}>
                <div className="card-line h-full rounded-3xl bg-panel p-7">
                  <h.icon className="size-5 text-warn" strokeWidth={1.7} />
                  <h3 className="font-display mt-4 text-lg font-semibold">{h.title}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-dim">{h.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.2}>
            <p className="mt-8 text-center font-mono text-[0.65rem] uppercase tracking-widest text-faint">
              full matrices live in <Link href="/docs" className="text-acid underline-offset-4 hover:underline">/docs</Link>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ————— FAQ ————— */}
      <section id="faq" className="mx-auto max-w-4xl px-5 py-24 sm:px-8">
        <Reveal>
          <p className="kicker text-center">{"// "}questions, answered straight</p>
          <h2 className="font-display mt-4 text-center text-3xl font-bold tracking-tight sm:text-4xl">FAQ</h2>
        </Reveal>
        <div className="mt-12 space-y-3">
          {FAQ.map((f, i) => (
            <Reveal key={f.q} delay={i * 0.05}>
              <details className="card-line group rounded-2xl bg-panel open:bg-panel2">
                <summary className="flex items-center justify-between gap-4 px-6 py-5 text-left">
                  <span className="text-sm font-semibold sm:text-base">{f.q}</span>
                  <span className="grid size-7 shrink-0 place-items-center rounded-full border border-ink/10 text-dim transition-transform duration-300 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="border-t border-ink/8 px-6 py-5 text-sm leading-relaxed text-dim">{f.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ————— CTA ————— */}
      <section className="relative overflow-hidden border-t border-ink/8">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="animate-aurora-a absolute -left-20 top-0 h-[340px] w-[440px] rounded-full bg-acid/[0.08] blur-[100px]" />
          <div className="animate-aurora-b absolute -right-16 bottom-0 h-[300px] w-[420px] rounded-full bg-mint/[0.06] blur-[100px]" />
        </div>
        <div className="relative mx-auto max-w-7xl px-5 py-24 text-center sm:px-8">
          <Reveal>
            <Wand2 className="mx-auto size-6 text-acid" strokeWidth={1.6} />
            <h2 className="font-display mx-auto mt-6 max-w-2xl text-4xl font-bold leading-[1.02] tracking-tight sm:text-5xl">
              Process a file. Check the network tab. <span className="text-stroke">Worry never.</span>
            </h2>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Link href="/image" className="inline-flex items-center gap-2 rounded-full bg-acid px-7 py-3.5 text-sm font-semibold text-[#0a0b05] transition-all hover:shadow-[0_0_40px_-8px] hover:shadow-acid/70">
                <ImageIcon className="size-4" /> Start with images
              </Link>
              <Link href="/metadata" className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-7 py-3.5 text-sm transition-colors hover:border-ink/40">
                <Braces className="size-4" /> Or just look inside one
              </Link>
            </div>
            <p className="mt-8 font-mono text-[0.65rem] uppercase tracking-widest text-faint">
              <Sparkles className="mr-1.5 inline size-3 text-acid" />
              free forever · open pipeline · no account, ever
            </p>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
