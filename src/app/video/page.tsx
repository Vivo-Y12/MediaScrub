"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import {
  AlertTriangle,
  ArrowDownToLine,
  Ban,
  CheckCircle2,
  CircleDashed,
  Cpu,
  Loader2,
  Play,
  Trash2,
  X,
} from "lucide-react";
import WorkspaceShell from "@/components/workspace-shell";
import Dropzone from "@/components/dropzone";
import { getFFmpeg, isFFmpegLoaded, terminateFFmpeg } from "@/lib/video/ffmpeg";
import {
  buildArgs,
  buildThumbnailArgs,
  DEFAULT_VIDEO_SETTINGS,
  outputExtension,
  VIDEO_INPUT_EXT,
  type VideoOperation,
  type VideoSettings,
} from "@/lib/video/operations";
import { getCapabilities, recommendedVideoLimitMb, type Capabilities } from "@/lib/capabilities";
import { pingStats } from "@/lib/stats";
import { assertNoSignedProvenance } from "@/lib/provenance/inspect";
import {
  cn,
  downloadBlob,
  formatBytes,
  formatDuration,
  savingsPct,
  uid,
  uniqueName,
  withExtension,
} from "@/lib/utils";

const ACCEPT = VIDEO_INPUT_EXT.map((e) => `.${e}`).join(",") + ",video/*";
const HARD_LIMIT_MB = 2048;

interface Thumb {
  name: string;
  blob: Blob;
  url: string;
}

interface Entry {
  id: string;
  file: File;
  srcUrl: string;
  probe: { duration: number | null; width: number | null; height: number | null };
  status: "queued" | "processing" | "done" | "error";
  progress: number;
  result?: { blob: Blob; url: string; ext: string; thumbs: Thumb[] };
  error?: string;
}

const OPERATIONS: { value: VideoOperation; label: string; blurb: string }[] = [
  { value: "trim", label: "Trim clip", blurb: "Set start/end times and export a real re-encoded clip" },
  { value: "compress", label: "Compress", blurb: "Re-encode at a target CRF — smaller file, same container" },
  { value: "convert", label: "Convert", blurb: "Re-mux & re-encode to MP4 (H.264) or WebM (VP9/VP8)" },
  { value: "scale", label: "Resize", blurb: "Change resolution while keeping fps & duration" },
  { value: "gif", label: "Make GIF", blurb: "Animated GIF at a chosen fps & width" },
  { value: "audio", label: "Extract audio", blurb: "Pull the soundtrack to MP3, WAV or OGG" },
  { value: "thumbnails", label: "Thumbnails", blurb: "Evenly spaced still frames as JPEGs" },
];

function inputExtOf(name: string): string {
  const m = name.match(/\.([a-z0-9]+)$/i);
  return (m?.[1] ?? "mp4").toLowerCase();
}

async function probeVideo(url: string): Promise<{ duration: number | null; width: number | null; height: number | null }> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    // Some mobile browsers never fire metadata or error for unsupported containers.
    const timer = window.setTimeout(() => done(null, null, null), 10_000);
    const done = (d: number | null, w: number | null, h: number | null) => {
      window.clearTimeout(timer);
      v.onloadedmetadata = null;
      v.onerror = null;
      v.removeAttribute("src");
      resolve({ duration: d, width: w, height: h });
    };
    v.onloadedmetadata = () => {
      const d = isFinite(v.duration) ? v.duration : null;
      done(d, v.videoWidth || null, v.videoHeight || null);
    };
    v.onerror = () => done(null, null, null); // browser cannot probe this container; FFmpeg may still decode it
    v.src = url;
  });
}

export default function VideoWorkspace() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [settings, setSettings] = useState<VideoSettings>(DEFAULT_VIDEO_SETTINGS);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [engine, setEngine] = useState<"cold" | "loading" | "warm">(isFFmpegLoaded() ? "warm" : "cold");
  const [running, setRunning] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const cancelRef = useRef(false);
  const runRef = useRef(0);
  const entriesRef = useRef<Entry[]>([]);
  useEffect(() => { entriesRef.current = entries; }, [entries]);

  useEffect(() => {
    getCapabilities().then(setCaps);
    return () => {
      cancelRef.current = true;
      runRef.current += 1;
      terminateFFmpeg();
      entriesRef.current.forEach(e => {
        URL.revokeObjectURL(e.srcUrl);
        e.result?.thumbs.forEach(t => URL.revokeObjectURL(t.url));
        if (e.result) URL.revokeObjectURL(e.result.url);
      });
    };
  }, []);

  const updateEntry = useCallback((id: string, patch: Partial<Entry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const addFiles = useCallback(async (files: File[]) => {
    const videos = files.filter((f) =>
      f.type.startsWith("video/") || VIDEO_INPUT_EXT.includes(inputExtOf(f.name) as (typeof VIDEO_INPUT_EXT)[number])
    );
    for (const file of videos) {
      const srcUrl = URL.createObjectURL(file);
      const probe = await probeVideo(srcUrl);
      setEntries((prev) => [
        ...prev,
        { id: uid("vid"), file, srcUrl, probe, status: "queued", progress: 0 },
      ]);
    }
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => {
      const t = prev.find((e) => e.id === id);
      if (t) {
        URL.revokeObjectURL(t.srcUrl);
        t.result?.thumbs.forEach((th) => URL.revokeObjectURL(th.url));
        if (t.result) URL.revokeObjectURL(t.result.url);
      }
      return prev.filter((e) => e.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    cancelRef.current = true;
    runRef.current += 1;
    terminateFFmpeg();
    setEngine("cold");
    setEntries((prev) => {
      prev.forEach((e) => {
        URL.revokeObjectURL(e.srcUrl);
        e.result?.thumbs.forEach((t) => URL.revokeObjectURL(t.url));
        if (e.result) URL.revokeObjectURL(e.result.url);
      });
      return [];
    });
  }, []);

  const cancel = () => {
    cancelRef.current = true;
    runRef.current += 1;
    terminateFFmpeg(); // hard-kill the WASM thread
    setEngine("cold");
    setRunning(false);
    setEntries((prev) =>
      prev.map((e) => (e.status === "processing" ? { ...e, status: "queued", progress: 0 } : e))
    );
  };

  const processAll = async () => {
    if (running) return;
    const todo = entries.filter((e) => e.status === "queued" || e.status === "error");
    if (!todo.length) return;
    cancelRef.current = false;
    const runId = ++runRef.current;
    const current = () => !cancelRef.current && runRef.current === runId;
    setRunning(true);
    setEngineError(null);
    let completed = 0;

    for (const entry of todo) {
      if (!current()) break;
      if (entry.file.size > HARD_LIMIT_MB * 1024 * 1024) {
        updateEntry(entry.id, { status: "error", error: `Over the ${HARD_LIMIT_MB} MB safety ceiling for in-browser WASM.` });
        continue;
      }
      if (settings.operation === "trim" && entry.probe.duration !== null && settings.trimEnd > entry.probe.duration + 0.1) {
        updateEntry(entry.id, { status: "error", progress: 0, error: `Trim end ${settings.trimEnd}s exceeds this video's ${entry.probe.duration.toFixed(2)}s duration.` });
        continue;
      }
      updateEntry(entry.id, { status: "processing", progress: 0.02, error: undefined });
      let ff: Awaited<ReturnType<typeof getFFmpeg>> | null = null;
      let inName = "";
      let outName = "";
      try {
        await assertNoSignedProvenance(entry.file);
        if (!current()) break;
        setEngine("loading");
        ff = await getFFmpeg(
          (p) => { if (current()) updateEntry(entry.id, { progress: Math.min(0.98, 0.05 + p.ratio * 0.93) }); },
          settings.operation === "trim" ? settings.trimEnd - settings.trimStart : entry.probe.duration ?? undefined
        );
        if (!current()) break;
        setEngine("warm");
        inName = `in-${entry.id}.${inputExtOf(entry.file.name)}`;
        const outExt = outputExtension(settings);
        outName = `out-${entry.id}.${outExt}`;

        await ff.writeFile(inName, new Uint8Array(await entry.file.arrayBuffer()));

        if (!current()) break;
        if (settings.operation === "thumbnails") {
          const pattern = `t-${entry.id}-%02d.jpg`;
          const args = buildThumbnailArgs(inName, pattern, entry.probe.duration ?? 0, settings.thumbCount);
          const code = await ff.exec(args);
          if (code !== 0) throw new Error("Frame extraction failed — the codec may be unsupported by this WASM build.");
          const dir = await ff.listDir("/");
          const thumbs: Thumb[] = [];
          for (const node of dir) {
            if (node.name.startsWith(`t-${entry.id}-`) && node.name.endsWith(".jpg")) {
              const data = await ff.readFile(node.name);
              const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
              const blob = new Blob([new Uint8Array(bytes)], { type: "image/jpeg" });
              thumbs.push({ name: node.name, blob, url: URL.createObjectURL(blob) });
              await ff.deleteFile(node.name);
            }
          }
          thumbs.sort((a, b) => a.name.localeCompare(b.name));
          if (!thumbs.length) throw new Error("No frames could be extracted from this file.");
          const zip = new JSZip();
          thumbs.forEach((t, i) => zip.file(`frame-${String(i + 1).padStart(2, "0")}.jpg`, t.blob));
          const bundle = await zip.generateAsync({ type: "blob" });
          if (!current()) { thumbs.forEach(t => URL.revokeObjectURL(t.url)); break; }
          updateEntry(entry.id, {
            status: "done",
            progress: 1,
            result: {
              blob: bundle,
              url: "",
              ext: "zip",
              thumbs,
            },
          });
        } else {
          const args = buildArgs(inName, outName, settings);
          const code = await ff.exec(args);
          if (code !== 0) {
            throw new Error(
              "FFmpeg rejected this conversion — the input codec or container is likely outside what the WASM core supports. Try a different target, or see Docs → limits."
            );
          }
          const data = await ff.readFile(outName);
          const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
          const mime =
            outExt === "gif"
              ? "image/gif"
              : outExt === "webm"
                ? "video/webm"
                : outExt === "mp4"
                  ? "video/mp4"
                  : outExt === "wav"
                    ? "audio/wav"
                    : outExt === "ogg"
                      ? "audio/ogg"
                      : "audio/mpeg";
          const blob = new Blob([new Uint8Array(bytes)], { type: mime });
          if (blob.size === 0) throw new Error("Output came back empty — conversion is not possible for this file.");
          if (!current()) break;
          updateEntry(entry.id, {
            status: "done",
            progress: 1,
            result: { blob, url: URL.createObjectURL(blob), ext: outExt, thumbs: [] },
          });
          await ff.deleteFile(outName).catch(() => undefined);
        }
        await ff.deleteFile(inName).catch(() => undefined);
        completed += 1;
      } catch (err) {
        if (current()) {
          updateEntry(entry.id, { status: "error", progress: 0, error: err instanceof Error ? err.message : "Processing failed" });
          if (!ff) { setEngine("cold"); setEngineError("The engine failed to load — check that /ffmpeg assets are reachable."); }
        }
      } finally {
        // Failed encodes may leave virtual FS files; delete them unless the engine was terminated.
        if (ff && current()) {
          if (inName) await ff.deleteFile(inName).catch(() => undefined);
          if (outName) await ff.deleteFile(outName).catch(() => undefined);
          const nodes = await ff.listDir("/").catch(() => []);
          for (const node of nodes) if (node.name.startsWith(`t-${entry.id}-`)) await ff.deleteFile(node.name).catch(() => undefined);
        }
      }
    }
    if (current()) {
      setRunning(false);
      if (completed > 0) pingStats(completed);
    }
  };

  const downloadAll = async () => {
    const done = entries.filter((e) => e.status === "done" && e.result);
    if (!done.length) return;
    const zip = new JSZip();
    const taken = new Set<string>();
    for (const e of done) {
      const name = uniqueName(withExtension(e.file.name, e.result!.ext === "zip" ? "frames.zip" : e.result!.ext), taken);
      taken.add(name);
      zip.file(name, e.result!.blob);
    }
    zip.file("MediaScrub-README.txt", "Transcoded locally by FFmpeg.wasm inside your browser.\nNo server received your media.\n");
    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, `mediascrub-videos-${new Date().toISOString().slice(0, 10)}.zip`);
  };

  const doneCount = entries.filter((e) => e.status === "done").length;
  const queuedCount = entries.filter((e) => e.status === "queued" || e.status === "error").length;
  const limitMb = useMemo(() => (caps ? recommendedVideoLimitMb(caps) : 500), [caps]);

  const needs = (op: VideoOperation, what: "target" | "crf" | "scale" | "gif" | "audio" | "thumbs" | "audioToggle") => {
    switch (what) {
      case "target": return op === "convert" || op === "compress" || op === "scale" || op === "trim";
      case "crf": return op === "convert" || op === "compress" || op === "scale" || op === "trim";
      case "scale": return op === "scale" || op === "compress";
      case "gif": return op === "gif";
      case "audio": return op === "audio";
      case "thumbs": return op === "thumbnails";
      case "audioToggle": return op === "convert" || op === "compress" || op === "scale" || op === "trim";
    }
  };

  return (
    <WorkspaceShell
      kicker="// 02 — video lab"
      title="Reshape video without it leaving the room."
      description="FFmpeg compiled to WebAssembly runs a full transcode pipeline in a sandboxed worker on your machine. MP4, WebM, MOV, MKV and AVI containers in — MP4, WebM, GIF, audio or stills out. Large files are memory-hungry. WebM C2PA inspection is unsupported by this reader; processing WebM may discard ordinary metadata."
    >
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* ————— settings ————— */}
        <aside className="space-y-6 self-start rounded-2xl border border-ink/10 bg-panel p-5 lg:sticky lg:top-24">
          <div>
            <p className="kicker mb-3">Operation</p>
            <div className="space-y-1.5">
              {OPERATIONS.map((op) => (
                <button
                  key={op.value}
                  onClick={() => setSettings((s) => ({ ...s, operation: op.value }))}
                  className={cn(
                    "w-full rounded-xl border px-3.5 py-2.5 text-left transition-colors",
                    settings.operation === op.value
                      ? "border-acid/50 bg-acid/[0.07]"
                      : "border-ink/10 hover:border-ink/25"
                  )}
                >
                  <span className="text-sm font-medium">{op.label}</span>
                  <span className="mt-0.5 block text-[0.7rem] leading-snug text-faint">{op.blurb}</span>
                </button>
              ))}
            </div>
          </div>

          {settings.operation === "trim" && <div className="space-y-3 rounded-xl border border-acid/20 bg-acid/5 p-4">
            <p className="kicker">Clip range · seconds</p>
            <div className="grid grid-cols-2 gap-2">{(["trimStart", "trimEnd"] as const).map(key => <label key={key} className="text-xs text-dim">{key === "trimStart" ? "Start" : "End"}<input type="number" min="0" step="0.1" value={settings[key]} className="mt-1 w-full rounded-lg border border-ink/15 bg-panel2 p-2 text-ink" onChange={e => setSettings(s => ({ ...s, [key]: Number(e.target.value) }))} /></label>)}</div>
            <p className="text-[0.7rem] text-dim">End must be after start and within a readable input duration. When duration is unknown, the output may end early; verify the exported clip.</p>
          </div>}

          {needs(settings.operation, "target") && (
            <div>
              <p className="kicker mb-3">Container</p>
              <div className="grid grid-cols-2 gap-1.5">
                {(["mp4", "webm"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setSettings((s) => ({ ...s, target: t }))}
                    className={cn(
                      "rounded-lg border px-3 py-2 font-mono text-xs uppercase transition-colors",
                      settings.target === t ? "border-acid/50 bg-acid/[0.07] text-ink" : "border-ink/10 text-dim"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {settings.target === "mp4" && (
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {(["libx264", "mpeg4"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setSettings((s) => ({ ...s, mp4Codec: c }))}
                      className={cn(
                        "rounded-lg border px-2 py-1.5 font-mono text-[0.65rem] transition-colors",
                        settings.mp4Codec === c ? "border-acid/50 text-ink" : "border-ink/10 text-dim"
                      )}
                    >
                      {c === "libx264" ? "H.264" : "MPEG-4 (fallback)"}
                    </button>
                  ))}
                </div>
              )}
              {settings.target === "webm" && (
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {(["libvpx-vp9", "libvpx"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setSettings((s) => ({ ...s, webmCodec: c }))}
                      className={cn(
                        "rounded-lg border px-2 py-1.5 font-mono text-[0.65rem] transition-colors",
                        settings.webmCodec === c ? "border-acid/50 text-ink" : "border-ink/10 text-dim"
                      )}
                    >
                      {c === "libvpx-vp9" ? "VP9" : "VP8 (fast)"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {needs(settings.operation, "crf") && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="kicker">Quality (CRF)</p>
                <span className="font-mono text-xs text-acid">{settings.crf}</span>
              </div>
              <input
                type="range"
                min={18}
                max={40}
                step={1}
                className="w-full"
                value={settings.crf}
                onChange={(e) => setSettings((s) => ({ ...s, crf: Number(e.target.value) }))}
              />
              <div className="mt-1 flex justify-between font-mono text-[0.6rem] uppercase tracking-wider text-faint">
                <span>18 · best</span>
                <span>40 · smallest</span>
              </div>
            </div>
          )}

          {needs(settings.operation, "scale") && (
            <div>
              <p className="kicker mb-3">Width (height follows)</p>
              <div className="grid grid-cols-4 gap-1.5">
                {[0, 640, 1280, 1920].map((w) => (
                  <button
                    key={w}
                    onClick={() => setSettings((s) => ({ ...s, scaleWidth: w }))}
                    className={cn(
                      "rounded-lg border px-1 py-1.5 font-mono text-[0.65rem] transition-colors",
                      settings.scaleWidth === w ? "border-acid/50 bg-acid/[0.07] text-ink" : "border-ink/10 text-dim"
                    )}
                  >
                    {w === 0 ? "KEEP" : w}
                  </button>
                ))}
              </div>
            </div>
          )}

          {needs(settings.operation, "gif") && (
            <div className="space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="kicker">Frame rate</p>
                  <span className="font-mono text-xs text-acid">{settings.gifFps} fps</span>
                </div>
                <input type="range" min={5} max={24} step={1} className="w-full" value={settings.gifFps}
                  onChange={(e) => setSettings((s) => ({ ...s, gifFps: Number(e.target.value) }))} />
              </div>
              <div>
                <p className="kicker mb-3">Width</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {[320, 480, 720].map((w) => (
                    <button key={w}
                      onClick={() => setSettings((s) => ({ ...s, gifWidth: w }))}
                      className={cn("rounded-lg border px-1 py-1.5 font-mono text-[0.65rem]",
                        settings.gifWidth === w ? "border-acid/50 bg-acid/[0.07] text-ink" : "border-ink/10 text-dim")}>
                      {w}px
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {needs(settings.operation, "audio") && (
            <div>
              <p className="kicker mb-3">Audio format</p>
              <div className="grid grid-cols-3 gap-1.5">
                {(["mp3", "wav", "ogg"] as const).map((f) => (
                  <button key={f}
                    onClick={() => setSettings((s) => ({ ...s, audioFormat: f }))}
                    className={cn("rounded-lg border px-1 py-1.5 font-mono text-xs uppercase",
                      settings.audioFormat === f ? "border-acid/50 bg-acid/[0.07] text-ink" : "border-ink/10 text-dim")}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}

          {needs(settings.operation, "thumbs") && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="kicker">Frames</p>
                <span className="font-mono text-xs text-acid">{settings.thumbCount}</span>
              </div>
              <input type="range" min={1} max={8} step={1} className="w-full" value={settings.thumbCount}
                onChange={(e) => setSettings((s) => ({ ...s, thumbCount: Number(e.target.value) }))} />
            </div>
          )}

          {needs(settings.operation, "audioToggle") && (
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-ink/10 px-3.5 py-2.5">
              <span className="text-sm">Keep audio track</span>
              <button
                role="switch"
                aria-checked={settings.includeAudio}
                onClick={(e) => {
                  e.preventDefault();
                  setSettings((s) => ({ ...s, includeAudio: !s.includeAudio }));
                }}
                className={cn("relative h-5 w-9 rounded-full transition-colors", settings.includeAudio ? "bg-acid" : "bg-ink/20")}
              >
                <span className={cn("absolute top-0.5 size-4 rounded-full bg-void transition-all", settings.includeAudio ? "left-[18px]" : "left-0.5")} />
              </button>
            </label>
          )}

          <div className="rounded-xl border border-ink/10 bg-panel2 p-3.5">
            <p className="kicker mb-1.5">Engine</p>
            <p className="flex items-center gap-2 text-[0.75rem] text-dim">
              <Cpu className="size-3.5" />
              {engine === "warm" ? (
                <span className="text-acid">FFmpeg.wasm loaded · ~31 MB in memory</span>
              ) : engine === "loading" ? (
                "loading WASM core…"
              ) : (
                "loads on first run · vendored same-origin"
              )}
            </p>
            <p className="mt-2 text-[0.7rem] leading-relaxed text-faint">
              Suggested ceiling on this device: ~{limitMb} MB per file. Hard stop at {HARD_LIMIT_MB / 1024} GB.
              Encoding speed ≈ 0.2–1× realtime depending on codec & CPU.
            </p>
            {engineError && <p className="mt-2 text-[0.7rem] text-danger">{engineError}</p>}
          </div>
        </aside>

        {/* ————— queue ————— */}
        <section className="min-w-0 space-y-5">
          <Dropzone
            accept={ACCEPT}
            onFiles={addFiles}
            title={entries.length ? "Add more videos" : "Drop videos here"}
            subtitle="MP4 · WebM · MOV · MKV · AVI · 3GP — decoded by WebAssembly, not by a server"
          />

          {entries.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={processAll}
                  disabled={running || queuedCount === 0}
                  className="inline-flex items-center gap-2 rounded-full bg-acid px-5 py-2.5 text-sm font-semibold text-[#0a0b05] transition-all hover:shadow-[0_0_30px_-8px] hover:shadow-acid/60 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                  {running ? "Transcoding…" : `Run on ${queuedCount || ""} ${queuedCount === 1 ? "file" : "files"}`}
                </button>
                {running ? (
                  <button
                    onClick={cancel}
                    className="inline-flex items-center gap-2 rounded-full border border-danger/40 px-5 py-2.5 text-sm text-danger transition-colors hover:bg-danger/10"
                  >
                    <Ban className="size-4" /> Cancel & kill engine
                  </button>
                ) : (
                  <button
                    onClick={downloadAll}
                    disabled={doneCount === 0}
                    className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-5 py-2.5 text-sm transition-colors hover:border-ink/40 disabled:opacity-40"
                  >
                    <ArrowDownToLine className="size-4" /> Download all (.zip)
                  </button>
                )}
                <button onClick={clearAll} disabled={running}
                  className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-4 py-2.5 text-sm text-dim hover:text-danger disabled:opacity-40">
                  <Trash2 className="size-4" /> Clear
                </button>
                <span className="ml-auto font-mono text-[0.65rem] uppercase tracking-widest text-faint">
                  {doneCount}/{entries.length} done
                </span>
              </div>

              <ul className="space-y-3">
                {entries.map((entry) => (
                  <VideoCard
                    key={entry.id}
                    entry={entry}
                    settings={settings}
                    removeDisabled={running}
                    onRemove={() => removeEntry(entry.id)}
                    onDownload={() => {
                      if (!entry.result) return;
                      const name = entry.result.ext === "zip"
                        ? withExtension(entry.file.name, "frames.zip")
                        : withExtension(entry.file.name, entry.result.ext);
                      downloadBlob(entry.result.blob, name);
                    }}
                  />
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </WorkspaceShell>
  );
}

function VideoCard({
  entry,
  settings,
  removeDisabled,
  onRemove,
  onDownload,
}: {
  entry: Entry;
  settings: VideoSettings;
  removeDisabled: boolean;
  onRemove: () => void;
  onDownload: () => void;
}) {
  const savings = entry.result && entry.result.ext !== "zip" ? savingsPct(entry.file.size, entry.result.blob.size) : null;
  const overSoft = entry.file.size > 800 * 1024 * 1024;
  const isPlayableOut = entry.result && ["mp4", "webm"].includes(entry.result.ext);

  return (
    <li className="card-line flex flex-col gap-4 rounded-2xl bg-panel p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <video src={entry.srcUrl} className="h-16 w-28 shrink-0 rounded-xl border border-ink/10 bg-void object-cover" muted preload="metadata" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={entry.file.name}>{entry.file.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.65rem] uppercase tracking-wider text-faint">
            <span>{formatBytes(entry.file.size)}</span>
            <span>{formatDuration(entry.probe.duration)}</span>
            {entry.probe.width && <span>{entry.probe.width}×{entry.probe.height}</span>}
            {settings.operation === "trim" && entry.probe.duration === null && (
              <span className="text-warn">Duration unknown · verify trimmed output</span>
            )}
            {entry.result && entry.result.ext !== "zip" && (
              <>
                <span className="text-dim">→</span>
                <span className="text-ink">{formatBytes(entry.result.blob.size)}</span>
                {savings && <span className={cn(savings.startsWith("−") ? "text-acid" : "text-warn")}>{savings}</span>}
                <span className="rounded bg-acid/10 px-1.5 py-0.5 text-acid">{entry.result.ext}</span>
              </>
            )}
            {overSoft && (
              <span className="inline-flex items-center gap-1 text-warn"><AlertTriangle className="size-3" /> heavy for WASM</span>
            )}
          </div>
          {entry.status === "processing" && (
            <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-ink/10">
              <div className="h-full rounded-full bg-acid transition-[width] duration-300" style={{ width: `${Math.round(entry.progress * 100)}%` }} />
            </div>
          )}
          {entry.status === "error" && <p className="mt-1.5 text-xs text-danger">{entry.error}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {entry.status === "queued" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 px-3 py-1.5 font-mono text-[0.6rem] uppercase tracking-wider text-dim">
              <CircleDashed className="size-3" /> queued
            </span>
          )}
          {entry.status === "processing" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-acid/30 px-3 py-1.5 font-mono text-[0.6rem] uppercase tracking-wider text-acid">
              <Loader2 className="size-3 animate-spin" /> {Math.round(entry.progress * 100)}%
            </span>
          )}
          {entry.status === "done" && (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-acid/30 bg-acid/5 px-3 py-1.5 font-mono text-[0.6rem] uppercase tracking-wider text-acid">
                <CheckCircle2 className="size-3" /> done
              </span>
              <button onClick={onDownload}
                className="grid size-9 place-items-center rounded-full bg-ink text-void transition-opacity hover:opacity-80"
                title="Download output" aria-label={`Download output of ${entry.file.name}`}>
                <ArrowDownToLine className="size-4" />
              </button>
            </>
          )}
          <button onClick={onRemove} disabled={removeDisabled}
            className="grid size-9 place-items-center rounded-full border border-ink/10 text-faint hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
            title="Remove" aria-label={`Remove ${entry.file.name}`}>
            <X className="size-4" />
          </button>
        </div>
      </div>

      {isPlayableOut && (
        <video src={entry.result!.url} controls className="max-h-[320px] w-full rounded-xl bg-void" preload="metadata" />
      )}
      {entry.result?.ext === "gif" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={entry.result.url} alt={`GIF of ${entry.file.name}`} className="max-h-[320px] w-full rounded-xl bg-void object-contain" />
      )}
      {entry.result && entry.result.thumbs.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {entry.result.thumbs.map((t, i) => (
            <button key={t.name} onClick={() => downloadBlob(t.blob, `${withExtension(entry.file.name, "")}frame-${i + 1}.jpg`)}
              className="group relative overflow-hidden rounded-lg border border-ink/10" title="Download frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.url} alt={`frame ${i + 1}`} className="aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-105" draggable={false} />
              <span className="absolute bottom-1.5 right-1.5 rounded bg-void/80 px-1.5 py-0.5 font-mono text-[0.55rem] text-ink opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
                save
              </span>
            </button>
          ))}
        </div>
      )}
    </li>
  );
}
