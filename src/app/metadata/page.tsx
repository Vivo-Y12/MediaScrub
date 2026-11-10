"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  Braces,
  Camera,
  ChevronDown,
  Container,
  File as FileIcon,
  FileBadge,
  Loader2,
  MapPin,
  ScanSearch,
  ShieldOff,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import WorkspaceShell from "@/components/workspace-shell";
import Dropzone from "@/components/dropzone";
import { inspectFile, inspectionToJsonBlob, type Inspection, type MetaSection } from "@/lib/metadata/inspect";
import { stripImageMetadata, stripVideoMetadata } from "@/lib/metadata/strip";
import { editJpegMetadata, type JpegPrivacyEdits } from "@/lib/metadata/edit-jpeg";
import { ImageProcessor } from "@/lib/image/processor";
import { pingStats } from "@/lib/stats";
import { assertNoSignedProvenance } from "@/lib/provenance/inspect";
import { cn, downloadBlob, formatBytes, isImageFile, isVideoFile, uid, withExtension } from "@/lib/utils";

const SECTION_ICONS = {
  file: FileIcon,
  camera: Camera,
  geo: MapPin,
  provenance: Sparkles,
  container: Container,
  other: Braces,
} as const;

interface Entry {
  id: string;
  file: File;
  previewUrl?: string;
  status: "idle" | "reading" | "done" | "error";
  data?: Inspection;
  stripping: boolean;
  strippedUrl?: string;
  stripError?: string;
}

const ACCEPT = "image/*,video/*,.tiff,.tif,.avif,.heic,.mkv,.avi";

export default function MetadataWorkspace() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const processorRef = useRef<ImageProcessor | null>(null);
  const entriesRef = useRef<Entry[]>([]);
  useEffect(() => { entriesRef.current = entries; }, [entries]);
  const [edits, setEdits] = useState<JpegPrivacyEdits>({ removeGps: true, removeSerial: false, artist: "", description: "" });

  useEffect(() => {
    return () => {
      processorRef.current?.destroy();
      entriesRef.current.forEach(e => {
        if (e.previewUrl) URL.revokeObjectURL(e.previewUrl);
        if (e.strippedUrl) URL.revokeObjectURL(e.strippedUrl);
      });
    };
  }, []);

  const updateEntry = useCallback((id: string, patch: Partial<Entry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const addFiles = useCallback(
    async (files: File[]) => {
      const media = files.filter((f) => isImageFile(f) || isVideoFile(f));
      for (const file of media) {
        const id = uid("meta");
        const previewUrl = file.type.startsWith("image/") && file.type !== "image/tiff" ? URL.createObjectURL(file) : undefined;
        setEntries((prev) => [...prev, { id, file, previewUrl, status: "reading" as const, stripping: false }]);
        setActiveId((cur) => cur ?? id);
        try {
          const data = await inspectFile(file);
          updateEntry(id, { status: "done", data });
          pingStats(1);
        } catch (err) {
          updateEntry(id, {
            status: "error",
            stripError: err instanceof Error ? err.message : "Inspection failed",
          });
        }
      }
    },
    [updateEntry]
  );

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => {
      const t = prev.find((e) => e.id === id);
      if (t) {
        if (t.previewUrl) URL.revokeObjectURL(t.previewUrl);
        if (t.strippedUrl) URL.revokeObjectURL(t.strippedUrl);
      }
      return prev.filter((e) => e.id !== id);
    });
    setActiveId((cur) => (cur === id ? null : cur));
  }, []);

  const clearAll = useCallback(() => {
    setEntries((prev) => {
      prev.forEach((e) => {
        if (e.previewUrl) URL.revokeObjectURL(e.previewUrl);
        if (e.strippedUrl) URL.revokeObjectURL(e.strippedUrl);
      });
      return [];
    });
    setActiveId(null);
  }, []);

  const editJpeg = async (entry: Entry) => {
    updateEntry(entry.id, { stripping: true, stripError: undefined });
    try {
      const blob = await editJpegMetadata(entry.file, edits);
      if (entry.strippedUrl) URL.revokeObjectURL(entry.strippedUrl);
      updateEntry(entry.id, { stripping: false, strippedUrl: URL.createObjectURL(blob) });
      downloadBlob(blob, `privacy-${entry.file.name}`);
    } catch (error) {
      updateEntry(entry.id, { stripping: false, stripError: error instanceof Error ? error.message : "JPEG editing failed" });
    }
  };

  const strip = async (entry: Entry) => {
    updateEntry(entry.id, { stripping: true, stripError: undefined });
    try {
      await assertNoSignedProvenance(entry.file);
      let blob: Blob;
      let outName: string;
      if (isImageFile(entry.file)) {
        if (!processorRef.current) processorRef.current = new ImageProcessor(1);
        const res = await stripImageMetadata(entry.file, processorRef.current);
        blob = res.blob;
        outName = withExtension(entry.file.name, res.outExt);
        if (res.warnings.length) {
          // surface encode fallbacks (e.g. BMP → PNG) without failing
          updateEntry(entry.id, { stripError: `Note: ${res.warnings.join(" ")}` });
        }
      } else if (isVideoFile(entry.file)) {
        blob = await stripVideoMetadata(entry.file);
        outName = entry.file.name;
      } else {
        throw new Error("Unsupported file type.");
      }
      if (entry.strippedUrl) URL.revokeObjectURL(entry.strippedUrl);
      const url = URL.createObjectURL(blob);
      updateEntry(entry.id, { stripping: false, strippedUrl: url });
      downloadBlob(blob, `clean-${outName}`);
    } catch (err) {
      updateEntry(entry.id, {
        stripping: false,
        stripError: err instanceof Error ? err.message : "Strip failed",
      });
    }
  };

  const active = entries.find((e) => e.id === activeId) ?? entries[entries.length - 1];

  return (
    <WorkspaceShell
      kicker="// 03 — metadata inspector"
      title="Read what's written inside your files."
      description="Inspect EXIF, GPS and XMP locally. Selectively edit ordinary JPEG privacy fields or export a processed copy. Signed Content Credentials are protected by a provenance check."
    >
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <aside className="space-y-5 self-start lg:sticky lg:top-24">
          <Dropzone
            compact
            accept={ACCEPT}
            onFiles={addFiles}
            title={entries.length ? "Add more files" : "Drop media to inspect"}
            subtitle="images & video · parsed in-browser"
          />

          {entries.length > 0 && (
            <div className="space-y-2">
              {entries.map((e) => (
                <div key={e.id} className={cn("flex items-center gap-1 rounded-xl border p-2 transition-colors", active?.id === e.id ? "border-acid/50 bg-acid/[0.06]" : "border-ink/10 bg-panel")}>
                  <button type="button" onClick={() => setActiveId(e.id)} className="flex min-w-0 flex-1 items-center gap-3 p-1 text-left" aria-label={`Inspect ${e.file.name}`}>
                    {e.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={e.previewUrl} alt="" className="size-10 rounded-lg border border-ink/10 object-cover" />
                    ) : <span className="grid size-10 place-items-center rounded-lg border border-ink/10 text-dim"><FileIcon className="size-4" /></span>}
                    <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium">{e.file.name}</span><span className="block font-mono text-[0.6rem] uppercase tracking-wider text-faint">{formatBytes(e.file.size)} · {e.status === "reading" ? "reading…" : e.status}</span></span>
                  </button>
                  <button type="button" aria-label={`Remove ${e.file.name}`} onClick={() => removeEntry(e.id)} className="rounded-full p-1.5 text-faint hover:text-danger"><X className="size-3.5" /></button>
                </div>
              ))}
              <button
                onClick={clearAll}
                className="inline-flex items-center gap-1.5 text-xs text-dim hover:text-danger"
              >
                <Trash2 className="size-3.5" /> clear all
              </button>
            </div>
          )}

          <div className="rounded-xl border border-warn/25 bg-warn/[0.04] p-4">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-warn">
              <AlertTriangle className="size-3.5" /> Honesty box
            </p>
            <p className="text-[0.72rem] leading-relaxed text-dim">
              EXIF privacy editing ≠ watermark removal. Invisible watermarks like SynthID live inside pixel data,
              not metadata blocks — this tool does <em>not</em> detect, verify, or remove them, and absence of
              provenance metadata is not proof of human authorship.
            </p>
          </div>
        </aside>

        <section className="min-w-0">
          {!active && (
            <div className="grid min-h-[320px] place-items-center rounded-2xl border border-dashed border-ink/15 bg-panel">
              <div className="text-center">
                <ScanSearch className="mx-auto size-8 text-faint" strokeWidth={1.5} />
                <p className="mt-3 text-sm text-dim">Add a file to see everything it carries.</p>
              </div>
            </div>
          )}

          {active && (
            <div className="space-y-4">
              <div className="card-line flex flex-wrap items-center gap-3 rounded-2xl bg-panel p-4">
                {active.previewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={active.previewUrl} alt={active.file.name} className="size-14 rounded-xl border border-ink/10 object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{active.file.name}</p>
                  <p className="font-mono text-[0.65rem] uppercase tracking-wider text-faint">
                    {formatBytes(active.file.size)} · {active.file.type || "unknown type"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => strip(active)}
                    disabled={active.stripping}
                    className="inline-flex items-center gap-2 rounded-full bg-acid px-4 py-2 text-xs font-semibold text-[#0a0b05] transition-all hover:shadow-[0_0_24px_-8px] hover:shadow-acid/60 disabled:opacity-40"
                  >
                    {active.stripping ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldOff className="size-3.5" />}
                    Re-encode / remux & download
                  </button>
                  {active.data && (
                    <button
                      onClick={() =>
                        downloadBlob(inspectionToJsonBlob(active.data!), withExtension(active.file.name, "report.json"))
                      }
                      className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-4 py-2 text-xs text-dim transition-colors hover:text-ink"
                    >
                      <ArrowDownToLine className="size-3.5" /> Export report (.json)
                    </button>
                  )}
                </div>
                {active.stripError && (
                  <p className={cn("w-full text-xs", active.stripError.startsWith("Note") ? "text-warn" : "text-danger")}>
                    {active.stripError}
                  </p>
                )}
                {active.strippedUrl && (
                  <p className="w-full text-xs text-acid">
                    Processed copy generated. Reinspect the download before sharing; removal is not a watermark scan.
                  </p>
                )}
              </div>

              {/\.jpe?g$/i.test(active.file.name) && <div className="card-line rounded-2xl bg-panel p-5">
                <h2 className="font-display text-base font-semibold">Selective JPEG privacy editor</h2>
                <p className="mt-2 text-xs leading-relaxed text-dim">Rebuilds only the EXIF segment without pixel re-encoding. Keeps other JPEG segments, but signed credentials are blocked; XMP or IPTC may still contain personal details. Inspect the exported copy before sharing. 20 MB limit.</p>
                <div className="mt-4 flex flex-wrap gap-4 text-xs">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={edits.removeGps} onChange={e => setEdits(v => ({ ...v, removeGps: e.target.checked }))} /> Remove EXIF GPS</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={edits.removeSerial} onChange={e => setEdits(v => ({ ...v, removeSerial: e.target.checked }))} /> Remove EXIF serial/owner</label>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs text-dim">Set artist (optional)<input maxLength={200} type="text" value={edits.artist} onChange={e => setEdits(v => ({ ...v, artist: e.target.value }))} className="mt-1 block w-full rounded-lg border border-ink/15 bg-panel2 p-2 text-ink" /></label>
                  <label className="text-xs text-dim">Set description (optional)<input maxLength={200} type="text" value={edits.description} onChange={e => setEdits(v => ({ ...v, description: e.target.value }))} className="mt-1 block w-full rounded-lg border border-ink/15 bg-panel2 p-2 text-ink" /></label>
                </div>
                <button type="button" disabled={active.stripping} onClick={() => editJpeg(active)} className="mt-4 rounded-full border border-acid/50 bg-acid/10 px-4 py-2 text-xs text-acid disabled:opacity-40">Apply JPEG privacy edits & download</button>
              </div>}

              {active.status === "reading" && (
                <div className="card-line grid min-h-[200px] place-items-center rounded-2xl bg-panel">
                  <Loader2 className="size-6 animate-spin text-acid" />
                </div>
              )}

              {active.data && (
                <>
                  {active.data.gps && (
                    <div className="rounded-xl border border-danger/30 bg-danger/[0.06] p-4">
                      <p className="flex items-center gap-2 text-xs font-semibold text-danger">
                        <MapPin className="size-3.5" /> This file reveals a precise location
                      </p>
                      <p className="mt-1 font-mono text-xs text-dim">
                        {active.data.gps.lat.toFixed(6)}, {active.data.gps.lon.toFixed(6)}
                      </p>
                      <a
                        className="mt-2 inline-flex items-center gap-1.5 text-xs text-mint underline-offset-4 hover:underline"
                        target="_blank"
                        rel="noreferrer"
                        href={`https://www.openstreetmap.org/?mlat=${active.data.gps.lat.toFixed(6)}&mlon=${active.data.gps.lon.toFixed(6)}#map=15/${active.data.gps.lat.toFixed(6)}/${active.data.gps.lon.toFixed(6)}`}
                      >
                        Open in OpenStreetMap ↗
                      </a>
                    </div>
                  )}

                  {active.data.sections.map((section) => (
                    <MetaSectionCard key={section.title} section={section} />
                  ))}

                  <div className="rounded-xl border border-ink/10 bg-panel2 p-4">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
                      <FileBadge className="size-3.5 text-acid" /> Provenance reality check
                    </p>
                    <ul className="space-y-1.5 text-[0.72rem] leading-relaxed text-dim">
                      {active.data.provenanceNotes.map((n, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-acid">→</span> {n}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </WorkspaceShell>
  );
}

function MetaSectionCard({ section }: { section: MetaSection }) {
  const Icon = SECTION_ICONS[section.icon];
  return (
    <details open={section.icon === "file" || section.icon === "geo" || section.icon === "provenance"} className="card-line overflow-hidden rounded-2xl bg-panel">
      <summary className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-panel2">
        <span className="flex items-center gap-2.5 text-sm font-medium">
          <Icon className={cn("size-4", section.icon === "geo" ? "text-danger" : section.icon === "provenance" ? "text-warn" : "text-acid")} />
          {section.title}
          <span className="rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[0.6rem] text-faint">
            {section.entries.length}
          </span>
        </span>
        <ChevronDown className="size-4 text-faint transition-transform [[open]>&]:rotate-180" />
      </summary>
      <div className="border-t border-ink/8">
        <dl className="divide-y divide-ink/5">
          {section.entries.map((e, i) => (
            <div key={i} className="grid gap-1 px-4 py-2.5 sm:grid-cols-[180px_1fr] sm:gap-4">
              <dt className="font-mono text-[0.65rem] uppercase tracking-wider text-faint">{e.key}</dt>
              <dd className="break-words text-xs leading-relaxed text-ink">{e.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </details>
  );
}
