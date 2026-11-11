"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import {
  AlertTriangle,
  ArrowDownToLine,
  CheckCircle2,
  CircleDashed,
  Eye,
  Loader2,
  Play,
  Trash2,
  X,
  Package,
} from "lucide-react";
import WorkspaceShell from "@/components/workspace-shell";
import Dropzone from "@/components/dropzone";
import CompareSlider from "@/components/compare-slider";
import { getCapabilities, type Capabilities, type EncodeFormat } from "@/lib/capabilities";
import { ImageProcessor } from "@/lib/image/processor";
import { DEFAULT_IMAGE_SETTINGS, type ImageSettings, type OutputFormat } from "@/lib/image/types";
import { pingStats } from "@/lib/stats";
import { assertNoSignedProvenance } from "@/lib/provenance/inspect";
import { cn, downloadBlob, formatBytes, savingsPct, uid, uniqueName, withExtension } from "@/lib/utils";

const ACCEPT = ".png,.jpg,.jpeg,.webp,.gif,.bmp,.tif,.tiff,.avif,.svg,image/*";

interface Entry {
  id: string;
  file: File;
  srcUrl: string;
  status: "queued" | "processing" | "done" | "error";
  progress: number;
  result?: {
    blob: Blob;
    url: string;
    outExt: string;
    outMime: string;
    width: number;
    height: number;
    srcWidth: number;
    srcHeight: number;
    warnings: string[];
    durationMs: number;
  };
  error?: string;
}

const FORMAT_OPTIONS: { value: OutputFormat; label: string; mime?: EncodeFormat; note?: string }[] = [
  { value: "original", label: "Keep original" },
  { value: "webp", label: "WebP", mime: "image/webp", note: "best all-round" },
  { value: "png", label: "PNG", mime: "image/png", note: "lossless" },
  { value: "jpeg", label: "JPEG", mime: "image/jpeg", note: "no transparency" },
  { value: "avif", label: "AVIF", mime: "image/avif", note: "smallest, newer browsers" },
];

export default function ImageWorkspace() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [settings, setSettings] = useState<ImageSettings>(DEFAULT_IMAGE_SETTINGS);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [running, setRunning] = useState(false);
  const [compareId, setCompareId] = useState<string | null>(null);
  const processorRef = useRef<ImageProcessor | null>(null);
  const cancelRef = useRef(false);
  const runRef = useRef(0);
  const entriesRef = useRef<Entry[]>([]);
  useEffect(() => { entriesRef.current = entries; }, [entries]);

  useEffect(() => {
    getCapabilities().then(setCaps);
    return () => {
      processorRef.current?.destroy();
      processorRef.current = null;
    };
  }, []);

  const updateEntry = useCallback((id: string, patch: Partial<Entry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const addFiles = useCallback((files: File[]) => {
    const images = files.filter((f) => ACCEPT.split(",").some((a) => a.trim().startsWith(".") ? f.name.toLowerCase().endsWith(a.trim()) : f.type.startsWith("image/")) );
    setEntries((prev) => [
      ...prev,
      ...images.map((file) => ({
        id: uid("entry"),
        file,
        srcUrl: URL.createObjectURL(file),
        status: "queued" as const,
        progress: 0,
      })),
    ]);
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => {
      const target = prev.find((e) => e.id === id);
      if (target) {
        URL.revokeObjectURL(target.srcUrl);
        if (target.result) URL.revokeObjectURL(target.result.url);
      }
      return prev.filter((e) => e.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    cancelRef.current = true;
    runRef.current += 1;
    processorRef.current?.destroy();
    processorRef.current = null;
    setEntries((prev) => {
      prev.forEach((e) => {
        URL.revokeObjectURL(e.srcUrl);
        if (e.result) URL.revokeObjectURL(e.result.url);
      });
      return [];
    });
    setRunning(false);
  }, []);

  // Object URLs must be revoked directly; a setState updater during unmount may never execute.
  useEffect(() => () => {
    cancelRef.current = true;
    runRef.current += 1;
    entriesRef.current.forEach(e => { URL.revokeObjectURL(e.srcUrl); if (e.result) URL.revokeObjectURL(e.result.url); });
  }, []);

  const processAll = async () => {
    if (!entries.length || running) return;
    if (!processorRef.current) processorRef.current = new ImageProcessor();
    const processor = processorRef.current;
    cancelRef.current = false;
    const runId = ++runRef.current;
    const current = () => !cancelRef.current && runRef.current === runId;
    setRunning(true);

    const snapshot = entries.filter((e) => e.status === "queued" || e.status === "error");
    let completed = 0;
    // Bound both provenance reads and image jobs: a large drop must not scan every file at once.
    for (let offset = 0; offset < snapshot.length && current(); offset += 3) {
      await Promise.all(snapshot.slice(offset, offset + 3).map(async (entry) => {
        if (!current()) return;
        updateEntry(entry.id, { status: "processing", progress: 0.05, error: undefined, result: undefined });
        try {
          await assertNoSignedProvenance(entry.file);
          if (!current()) return;
          const { promise } = processor.process(entry.file, settings, (p) => {
            if (current()) updateEntry(entry.id, { progress: p });
          });
          const res = await promise;
          if (!current()) return;
          completed += 1;
          updateEntry(entry.id, {
            status: "done",
            progress: 1,
            result: { ...res, url: URL.createObjectURL(res.blob) },
          });
        } catch (err) {
          if (!current()) return;
          updateEntry(entry.id, {
            status: "error",
            progress: 0,
            error: err instanceof Error ? err.message : "Processing failed",
          });
        }
      }));
    }
    if (current()) {
      setRunning(false);
      if (completed > 0) pingStats(completed);
    }
  };

  const cancel = () => {
    cancelRef.current = true;
    runRef.current += 1;
    processorRef.current?.destroy();
    processorRef.current = null;
    setEntries(prev => prev.map(e => e.status === "processing" ? { ...e, status: "queued", progress: 0 } : e));
    setRunning(false);
  };

  const downloadAllZip = async () => {
    const done = entries.filter((e) => e.status === "done" && e.result);
    if (!done.length) return;
    const zip = new JSZip();
    const taken = new Set<string>();
    for (const e of done) {
      const name = uniqueName(withExtension(e.file.name, e.result!.outExt), taken);
      taken.add(name);
      zip.file(name, e.result!.blob);
    }
    zip.file(
      "MediaScrub-README.txt",
      "Processed locally in your browser by MediaScrub.\nNo server saw these files. Metadata was stripped during re-encode.\n"
    );
    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, `mediascrub-images-${new Date().toISOString().slice(0, 10)}.zip`);
  };

  const compareEntry = useMemo(() => entries.find((e) => e.id === compareId && e.result), [entries, compareId]);
  const doneCount = entries.filter((e) => e.status === "done").length;
  const queuedCount = entries.filter((e) => e.status === "queued" || e.status === "error").length;

  const formatDisabled = (opt: (typeof FORMAT_OPTIONS)[number]) =>
    opt.mime && caps?.checked && caps.encode[opt.mime] === false;

  return (
    <WorkspaceShell
      kicker="// 01 — image studio"
      title="Convert, compress & resize images. Privately."
      description="Drag in PNG, JPEG, WebP, GIF, BMP, TIFF, AVIF or SVG. Everything is decoded and re-encoded by a Web Worker on your machine — pixels travel through your RAM and nowhere else. Canvas re-encoding also strips every byte of embedded metadata."
    >
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* ————— settings panel ————— */}
        <aside className="space-y-6 self-start rounded-2xl border border-ink/10 bg-panel p-5 lg:sticky lg:top-24">
          <div>
            <p className="kicker mb-3">Output format</p>
            <div className="space-y-1.5">
              {FORMAT_OPTIONS.map((opt) => {
                const disabled = formatDisabled(opt) ?? false;
                return (
                  <label
                    key={opt.value}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-sm transition-colors focus-within:ring-2 focus-within:ring-acid/60",
                      settings.format === opt.value
                        ? "border-acid/50 bg-acid/[0.07] text-ink"
                        : "border-ink/10 text-dim hover:border-ink/25",
                      disabled && "cursor-not-allowed opacity-40"
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="format"
                        className="size-4 shrink-0 accent-acid"
                        disabled={disabled}
                        checked={settings.format === opt.value}
                        onChange={() => setSettings((s) => ({ ...s, format: opt.value }))}
                      />
                      <span className="text-ink">{opt.label}</span>
                    </span>
                    <span className="font-mono text-[0.6rem] uppercase tracking-wider text-faint">
                      {disabled ? "not in this browser" : opt.note}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="kicker">Quality</p>
              <span className="font-mono text-xs text-acid">{Math.round(settings.quality * 100)}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              step={1}
              className="w-full"
              value={Math.round(settings.quality * 100)}
              disabled={settings.format === "png"}
              onChange={(e) => setSettings((s) => ({ ...s, quality: Number(e.target.value) / 100 }))}
            />
            <p className="mt-1.5 text-[0.7rem] leading-relaxed text-faint">
              Lossy slider — affects WebP / JPEG / AVIF. PNG stays pixel-perfect.
            </p>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="kicker">Scale</p>
              <span className="font-mono text-xs text-acid">{settings.scalePercent}%</span>
            </div>
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              className="w-full"
              value={settings.scalePercent}
              onChange={(e) => setSettings((s) => ({ ...s, scalePercent: Number(e.target.value) }))}
            />
          </div>

          <div>
            <p className="kicker mb-3">Max longest edge</p>
            <div className="grid grid-cols-5 gap-1.5">
              {[0, 1080, 1920, 2560, 3840].map((v) => (
                <button
                  key={v}
                  onClick={() => setSettings((s) => ({ ...s, maxDimension: v }))}
                  className={cn(
                    "rounded-lg border px-1 py-1.5 font-mono text-[0.65rem] transition-colors",
                    settings.maxDimension === v
                      ? "border-acid/50 bg-acid/[0.07] text-ink"
                      : "border-ink/10 text-dim hover:border-ink/25"
                  )}
                >
                  {v === 0 ? "OFF" : v}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 border-t border-ink/10 pt-5">
            <p className="kicker">Crop & rotate</p>
            <p className="text-[0.7rem] leading-relaxed text-dim">Crop coordinates are percentages of each original image; all files in this batch share the settings.</p>
            <label className="block text-xs text-dim">Clockwise rotation
              <select className="mt-1 w-full rounded-lg border border-ink/15 bg-panel2 p-2 text-ink" value={settings.rotation} onChange={e => setSettings(s => ({ ...s, rotation: Number(e.target.value) as ImageSettings["rotation"] }))}>
                {[0,90,180,270].map(n => <option key={n} value={n}>{n}°</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["x", "y", "width", "height"] as const).map(key => <label key={key} className="text-xs capitalize text-dim">{key} %
                <input type="number" min={key === "width" || key === "height" ? 1 : 0} max={key === "width" ? 100 - settings.crop.x : key === "height" ? 100 - settings.crop.y : 99} value={settings.crop[key]} className="mt-1 w-full rounded-lg border border-ink/15 bg-panel2 p-2 text-ink" onChange={e => setSettings(s => {
                  const value = Math.max(key === "width" || key === "height" ? 1 : 0, Math.min(100, Number(e.target.value) || 0));
                  const crop = { ...s.crop, [key]: value };
                  crop.x = Math.min(99, crop.x); crop.y = Math.min(99, crop.y);
                  crop.width = Math.max(1, Math.min(crop.width, 100 - crop.x));
                  crop.height = Math.max(1, Math.min(crop.height, 100 - crop.y));
                  return { ...s, crop };
                })} />
              </label>)}
            </div>
          </div>

          {settings.format === "jpeg" && (
            <div>
              <p className="kicker mb-2">Transparency fill</p>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={settings.alphaFill}
                  onChange={(e) => setSettings((s) => ({ ...s, alphaFill: e.target.value }))}
                  className="size-9 cursor-pointer rounded-lg border border-ink/15 bg-transparent"
                />
                <span className="font-mono text-xs text-dim">{settings.alphaFill}</span>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-ink/10 bg-panel2 p-3.5">
            <p className="kicker mb-1.5">Metadata policy</p>
            <p className="text-[0.75rem] leading-relaxed text-dim">
              Every output is rebuilt pixel-by-pixel through a canvas, so EXIF, XMP, GPS and ICC blocks
              physically cannot survive. <span className="text-ink">Always on, cannot be turned off.</span>
            </p>
          </div>

          {caps?.checked && (
            <div className="rounded-xl border border-ink/10 bg-panel2 p-3.5">
              <p className="kicker mb-2">This browser can encode</p>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(caps.encode) as EncodeFormat[]).map((m) => (
                  <span
                    key={m}
                    className={cn(
                      "rounded-full px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-wider",
                      caps.encode[m] === true ? "bg-acid/10 text-acid" : "bg-ink/5 text-faint line-through"
                    )}
                  >
                    {m.replace("image/", "")}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[0.7rem] text-faint">
                Detected live in your session — we never guess.
              </p>
            </div>
          )}
        </aside>

        {/* ————— main area ————— */}
        <section className="min-w-0 space-y-5">
          <Dropzone
            accept={ACCEPT}
            onFiles={addFiles}
            disabled={running}
            title={entries.length ? "Add more images" : "Drop images here"}
            subtitle="PNG · JPEG · WebP · GIF · BMP · TIFF · AVIF · SVG — processed on-device"
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
                  {running ? "Processing…" : `Process ${queuedCount || ""} ${queuedCount === 1 ? "file" : "files"}`}
                </button>
                {running ? (
                  <button
                    onClick={cancel}
                    className="inline-flex items-center gap-2 rounded-full border border-danger/40 px-5 py-2.5 text-sm text-danger transition-colors hover:bg-danger/10"
                  >
                    <X className="size-4" /> Stop
                  </button>
                ) : (
                  <button
                    onClick={downloadAllZip}
                    disabled={doneCount === 0}
                    className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-5 py-2.5 text-sm text-ink transition-colors hover:border-ink/40 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Package className="size-4" /> Download all (.zip)
                  </button>
                )}
                <button
                  onClick={clearAll}
                  disabled={running}
                  className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-4 py-2.5 text-sm text-dim transition-colors hover:text-danger disabled:opacity-40"
                >
                  <Trash2 className="size-4" /> Clear
                </button>
                <span className="ml-auto font-mono text-[0.65rem] uppercase tracking-widest text-faint">
                  {doneCount}/{entries.length} done
                </span>
              </div>

              <ul className="space-y-3">
                {entries.map((entry) => (
                  <ImageCard
                    key={entry.id}
                    entry={entry}
                    removeDisabled={running}
                    onRemove={() => removeEntry(entry.id)}
                    onCompare={() => entry.result && setCompareId(entry.id)}
                    onDownload={() =>
                      entry.result &&
                      downloadBlob(entry.result.blob, withExtension(entry.file.name, entry.result.outExt))
                    }
                  />
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      {compareEntry?.result && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-void/80 p-4 backdrop-blur-md"
          onClick={() => setCompareId(null)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl border border-ink/10 bg-panel p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="min-w-0 truncate font-mono text-xs text-dim">{compareEntry.file.name}</p>
              <button
                onClick={() => setCompareId(null)}
                className="rounded-full border border-ink/15 p-1.5 text-dim hover:text-ink"
                aria-label="Close comparison"
              >
                <X className="size-4" />
              </button>
            </div>
            <CompareSlider beforeUrl={compareEntry.srcUrl} afterUrl={compareEntry.result.url} alt={compareEntry.file.name} />
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}

function ImageCard({
  entry,
  removeDisabled,
  onRemove,
  onCompare,
  onDownload,
}: {
  entry: Entry;
  removeDisabled: boolean;
  onRemove: () => void;
  onCompare: () => void;
  onDownload: () => void;
}) {
  const [showWarnings, setShowWarnings] = useState(false);
  const savings = entry.result ? savingsPct(entry.file.size, entry.result.blob.size) : null;
  const big = entry.file.size > 60 * 1024 * 1024;

  return (
    <li className="card-line flex flex-col gap-4 rounded-2xl bg-panel p-4 sm:flex-row sm:items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={entry.srcUrl}
        alt={entry.file.name}
        className="size-16 shrink-0 rounded-xl border border-ink/10 bg-void object-cover"
        draggable={false}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={entry.file.name}>
          {entry.file.name}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.65rem] uppercase tracking-wider text-faint">
          <span>{formatBytes(entry.file.size)}</span>
          {entry.result && (
            <>
              <span className="text-dim">→</span>
              <span className="text-ink">{formatBytes(entry.result.blob.size)}</span>
              {savings && (
                <span className={cn(savings.startsWith("−") ? "text-acid" : "text-warn")}>{savings}</span>
              )}
              <span className="text-dim">
                {entry.result.srcWidth}×{entry.result.srcHeight} → {entry.result.width}×{entry.result.height}
              </span>
              <span className="rounded bg-acid/10 px-1.5 py-0.5 text-acid">{entry.result.outExt}</span>
            </>
          )}
          {big && (
            <span className="inline-flex items-center gap-1 text-warn">
              <AlertTriangle className="size-3" /> large file · may be slow
            </span>
          )}
        </div>
        {entry.status === "processing" && (
          <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-ink/10">
            <div
              className="h-full rounded-full bg-acid transition-[width] duration-300"
              style={{ width: `${Math.round(entry.progress * 100)}%` }}
            />
          </div>
        )}
        {entry.status === "error" && (
          <p className="mt-1.5 text-xs text-danger">{entry.error}</p>
        )}
        {entry.result && entry.result.warnings.length > 0 && (
          <div className="relative mt-1.5">
            <button
              onClick={() => setShowWarnings((v) => !v)}
              className="inline-flex items-center gap-1 text-[0.7rem] text-warn hover:underline"
            >
              <AlertTriangle className="size-3" />
              {entry.result.warnings.length} {entry.result.warnings.length === 1 ? "note" : "notes"}
            </button>
            {showWarnings && (
              <div className="absolute left-0 top-6 z-20 w-72 rounded-xl border border-ink/10 bg-panel2 p-3 shadow-xl">
                <ul className="space-y-1 text-[0.7rem] leading-relaxed text-dim">
                  {entry.result.warnings.map((w, i) => (
                    <li key={i}>· {w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
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
            <button
              onClick={onCompare}
              className="grid size-9 place-items-center rounded-full border border-ink/15 text-dim transition-colors hover:text-ink"
              title="Before / after"
              aria-label="Compare before and after"
            >
              <Eye className="size-4" />
            </button>
            <button
              onClick={onDownload}
              className="grid size-9 place-items-center rounded-full bg-ink text-void transition-opacity hover:opacity-80"
              title="Download"
              aria-label={`Download ${entry.file.name}`}
            >
              <ArrowDownToLine className="size-4" />
            </button>
          </>
        )}
        <button
          onClick={onRemove}
          disabled={removeDisabled}
          className="grid size-9 place-items-center rounded-full border border-ink/10 text-faint transition-colors hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
          title="Remove"
          aria-label={`Remove ${entry.file.name}`}
        >
          <X className="size-4" />
        </button>
      </div>
    </li>
  );
}
