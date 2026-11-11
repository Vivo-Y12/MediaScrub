import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus, X, AlertTriangle } from "lucide-react";
import Reveal from "@/components/reveal";

export const metadata: Metadata = {
  title: "Supported formats & honest limits",
  description:
    "Exactly which image and video formats MediaScrub can read and write in-browser, what depends on your device, and where the hard edges are.",
};

function Cell({ state, note }: { state: "yes" | "partial" | "no"; note?: string }) {
  const map = {
    yes: <Check className="size-4 text-acid" />,
    partial: <Minus className="size-4 text-warn" />,
    no: <X className="size-4 text-danger" />,
  };
  return (
    <td className="px-4 py-3">
      <span className="flex items-center gap-2">
        {map[state]}
        {note && <span className="text-[0.7rem] text-faint">{note}</span>}
      </span>
    </td>
  );
}

const IMAGE_ROWS: { name: string; read: "yes" | "partial" | "no"; readNote?: string; write: "yes" | "partial" | "no"; writeNote?: string }[] = [
  { name: "PNG", read: "yes", write: "yes", writeNote: "lossless" },
  { name: "JPEG", read: "yes", write: "yes", writeNote: "no alpha" },
  { name: "WebP", read: "yes", write: "partial", writeNote: "encode support varies" },
  { name: "GIF", read: "partial", readNote: "first frame only", write: "no", writeNote: "use Video lab for GIFs" },
  { name: "BMP", read: "yes", write: "no", writeNote: "exports as PNG" },
  { name: "TIFF", read: "partial", readNote: "first page, common compressions", write: "no" },
  { name: "AVIF", read: "partial", readNote: "browser-dependent", write: "partial", writeNote: "rare encode support" },
  { name: "SVG", read: "partial", readNote: "rasterized at intrinsic size", write: "no" },
  { name: "HEIC", read: "no", readNote: "no browser decoder — convert via OS first", write: "no" },
];

const VIDEO_ROWS: { name: string; read: "yes" | "partial" | "no"; readNote?: string; encoders?: string }[] = [
  { name: "MP4 (H.264/H.265)", read: "yes", encoders: "H.264 out · MPEG-4 fallback" },
  { name: "WebM (VP8/VP9/AV1)", read: "yes", encoders: "VP9 out · VP8 fast mode" },
  { name: "MOV (QuickTime)", read: "partial", readNote: "demux fine; codec-dependent", encoders: "re-encodes to MP4" },
  { name: "MKV (Matroska)", read: "partial", readNote: "demux fine; codec-dependent", encoders: "re-encodes to MP4/WebM" },
  { name: "AVI", read: "partial", readNote: "legacy codecs vary", encoders: "re-encodes to MP4/WebM" },
  { name: "Output audio", read: "yes", encoders: "MP3 · WAV · OGG extraction" },
  { name: "Output GIF", read: "yes", encoders: "fps + width controls" },
];

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
      <Reveal>
        <p className="kicker">{"// "}documentation</p>
        <h1 className="font-display mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
          Formats & limits, in writing.
        </h1>
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-dim sm:text-base">
          Everything below is what the code actually does — probed live in your browser where possible.
          If a row says &quot;varies&quot;, the app will tell you in-session rather than fail silently.
        </p>
      </Reveal>

      <Reveal delay={0.08}>
        <h2 className="font-display mt-14 text-2xl font-semibold">Image pipeline</h2>
        <p className="mt-2 text-sm text-dim">
          Decode → optional resize → re-encode through <code className="rounded bg-panel2 px-1.5 py-0.5 font-mono text-xs text-acid">OffscreenCanvas</code> inside a Web Worker.
          Re-encoding through pixels drops EXIF/XMP/GPS/ICC in new outputs. Media with embedded C2PA manifests or provenance metadata hints is blocked before processing to protect origin information.
        </p>
        <div className="card-line mt-6 overflow-x-auto rounded-2xl bg-panel">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink/8 font-mono text-[0.6rem] uppercase tracking-widest text-faint">
                <th className="px-4 py-3 font-normal">Format</th>
                <th className="px-4 py-3 font-normal">Read</th>
                <th className="px-4 py-3 font-normal">Write</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {IMAGE_ROWS.map((r) => (
                <tr key={r.name}>
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <Cell state={r.read} note={r.readNote} />
                  <Cell state={r.write} note={r.writeNote} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>

      <Reveal delay={0.12}>
        <h2 className="font-display mt-14 text-2xl font-semibold">Video pipeline</h2>
        <p className="mt-2 text-sm text-dim">
          FFmpeg compiled to WebAssembly (<code className="rounded bg-panel2 px-1.5 py-0.5 font-mono text-xs text-acid">@ffmpeg/core 0.12</code>, single-threaded, vendored same-origin).
          Demuxing is broad; decoding depends on the codecs compiled into the WASM core.
        </p>
        <div className="card-line mt-6 overflow-x-auto rounded-2xl bg-panel">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink/8 font-mono text-[0.6rem] uppercase tracking-widest text-faint">
                <th className="px-4 py-3 font-normal">Container</th>
                <th className="px-4 py-3 font-normal">Decode</th>
                <th className="px-4 py-3 font-normal">Output notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {VIDEO_ROWS.map((r) => (
                <tr key={r.name}>
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <Cell state={r.read} note={r.readNote} />
                  <td className="px-4 py-3 text-[0.78rem] text-dim">{r.encoders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>

      <Reveal delay={0.16}>
        <h2 className="font-display mt-14 text-2xl font-semibold">Device limits</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="card-line rounded-2xl bg-panel p-6">
            <h3 className="text-sm font-semibold">Images</h3>
            <ul className="mt-3 space-y-2 text-[0.82rem] leading-relaxed text-dim">
              <li>· Tested comfortably to ~50 MP per image on desktop; mobile handles ~20 MP well.</li>
              <li>· Files above ~60 MB get an explicit &quot;may be slow&quot; marker — not a block.</li>
              <li>· Batches process through a small worker pool (≤3) to protect memory.</li>
            </ul>
          </div>
          <div className="card-line rounded-2xl bg-panel p-6">
            <h3 className="text-sm font-semibold">Video</h3>
            <ul className="mt-3 space-y-2 text-[0.82rem] leading-relaxed text-dim">
              <li>· The WASM filesystem holds input + output in RAM — the limiter is device memory.</li>
              <li>· Suggested ceiling is computed per device (≈250 MB on low-end, 1.5 GB on strong desktops); 2 GB is a hard stop.</li>
              <li>· Speed ≈ 0.2–1× realtime, single-threaded. VP9 encode is slower than H.264.</li>
              <li>· Cancel kills the engine thread immediately and reloads it on the next run.</li>
            </ul>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.2}>
        <div className="mt-14 rounded-2xl border border-warn/25 bg-warn/[0.04] p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <AlertTriangle className="size-5 text-warn" /> What we deliberately do not do
          </h2>
          <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-dim">
            <li>· <span className="text-ink">No in-app SynthID detector or removal claims.</span> Metadata edits and C2PA inspection do not prove an invisible watermark is gone.</li>
            <li>· <span className="text-ink">No provenance forgery.</span> A separate inspector validates embedded C2PA records locally. Processing stops if a signed manifest is detected; no credentials are forged.</li>
            <li>· <span className="text-ink">No silent degradation.</span> If an operation can&apos;t run, you get the real error and a suggestion — never a quietly-wrong file.</li>
            <li>· <span className="text-ink">No cloud fallback.</span> If local processing fails, that&apos;s the answer — files are never rerouted to a server.</li>
          </ul>
          <p className="mt-5 text-sm text-dim">
            Privacy architecture details live on the <Link className="text-acid underline-offset-4 hover:underline" href="/privacy">privacy page</Link>.
          </p>
        </div>
      </Reveal>

      <div id="faq" className="mt-16 border-t border-ink/8 pt-8">
        <p className="text-sm text-dim">
          Frequently asked questions live on the <Link className="text-acid underline-offset-4 hover:underline" href="/#faq">landing page FAQ</Link>.
        </p>
      </div>
    </div>
  );
}
