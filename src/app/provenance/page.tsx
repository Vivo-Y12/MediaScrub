"use client";
/* eslint-disable @next/next/no-img-element -- previews are local blob URLs, not server-optimizable assets */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowDownToLine, ArrowUpRight, CheckCircle2, FileSearch, Info, Loader2, ShieldAlert, ShieldCheck, Trash2, X } from "lucide-react";
import Dropzone from "@/components/dropzone";
import WorkspaceShell from "@/components/workspace-shell";
import { inspectProvenance, reportBlob, type ProvenanceReport } from "@/lib/provenance/inspect";
import { downloadBlob, formatBytes, uid, withExtension } from "@/lib/utils";

type Item = { id: string; file: File; url: string; status: "queued" | "reading" | "done"; report?: ProvenanceReport };
const statuses = {
  trusted: { label: "Trusted", icon: ShieldCheck, color: "text-acid" },
  valid: { label: "Signature valid · trust not checked", icon: CheckCircle2, color: "text-acid" },
  invalid: { label: "Invalid / unverifiable", icon: ShieldAlert, color: "text-danger" },
  "not-detected": { label: "No C2PA manifest detected", icon: Info, color: "text-warn" },
  unsupported: { label: "Unsupported format", icon: AlertTriangle, color: "text-warn" },
  unavailable: { label: "Verification unavailable", icon: AlertTriangle, color: "text-warn" },
} as const;

export default function ProvenanceWorkspace() {
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const itemsRef = useRef<Item[]>([]);
  const cancelled = useRef(false);
  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => () => { cancelled.current = true; itemsRef.current.forEach(i => URL.revokeObjectURL(i.url)); }, []);

  const addFiles = useCallback((files: File[]) => {
    const added = files.map(file => ({ id: uid("prov"), file, url: URL.createObjectURL(file), status: "queued" as const }));
    setItems(previous => [...previous, ...added]);
    setSelected(current => current ?? added[0]?.id ?? null);
  }, []);
  const remove = (id: string) => {
    setItems(previous => { const match = previous.find(i => i.id === id); if (match) URL.revokeObjectURL(match.url); return previous.filter(i => i.id !== id); });
    if (selected === id) setSelected(null);
  };
  const clear = () => {
    cancelled.current = true;
    items.forEach(i => URL.revokeObjectURL(i.url));
    setItems([]); setSelected(null);
  };
  const scan = async () => {
    if (running) return;
    cancelled.current = false; setRunning(true);
    for (const item of items.filter(i => i.status === "queued")) {
      if (cancelled.current) break;
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: "reading" } : i));
      const report = await inspectProvenance(item.file);
      if (cancelled.current) break;
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: "done", report } : i));
    }
    setItems(prev => prev.map(i => i.status === "reading" ? { ...i, status: "queued" } : i));
    setRunning(false);
  };
  const active = items.find(i => i.id === selected) ?? items[0];
  const result = active?.report;
  const badge = result ? statuses[result.state] : null;

  return <WorkspaceShell kicker="// 00 — provenance" title="Inspect the record. Don't rewrite it." description="Read original image and video files locally. Verify embedded C2PA Content Credentials with the official WebAssembly reader, review provenance history and export a technical report. No media is uploaded.">
    <section id="c2pa-check" aria-labelledby="c2pa-check-heading">
      <div className="mb-5 rounded-2xl border border-ink/10 bg-panel p-5 sm:p-6">
        <p className="kicker">01 · Content Credentials · on-device</p>
        <h2 id="c2pa-check-heading" className="font-display mt-2 flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck className="size-5 text-acid" /> C2PA provenance inspection
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-dim">
          Choose an original file below to inspect its signed provenance locally. The file is not modified or uploaded.
          A valid signature is not proof that you trust the signer, and no credential found is not a SynthID result.
        </p>
      </div>
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <aside className="min-w-0 space-y-4">
        <Dropzone compact accept="image/*,video/*,.tif,.tiff,.avif,.mov,.mkv,.avi" title="Add original media" subtitle="Images & videos · no upload" onFiles={addFiles} />
        {items.length > 0 && <>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={scan} disabled={running || !items.some(i => i.status === "queued")} className="rounded-full bg-acid px-4 py-2 text-xs font-semibold text-[#0a0b05] disabled:opacity-40">{running ? "Inspecting…" : "Inspect queued"}</button>
            <button type="button" onClick={clear} className="inline-flex items-center gap-1 rounded-full border border-ink/15 px-3 py-2 text-xs text-dim"><Trash2 className="size-3" /> Clear</button>
          </div>
          {running && <p role="status" className="flex items-center gap-2 text-xs text-dim"><Loader2 className="size-4 animate-spin" /> Reading file and validating locally. Please wait…</p>}
          <ul className="space-y-2">{items.map(i => <li key={i.id} className={`flex items-center gap-2 rounded-xl border p-2 ${active?.id === i.id ? "border-acid/50 bg-acid/[0.06]" : "border-ink/10 bg-panel"}`}>
            <button type="button" onClick={() => setSelected(i.id)} className="min-w-0 flex-1 text-left"><span className="block truncate text-xs font-medium">{i.file.name}</span><span className="font-mono text-[0.6rem] uppercase text-faint">{formatBytes(i.file.size)} · {i.report ? statuses[i.report.state].label : i.status}</span></button>
            <button type="button" onClick={() => remove(i.id)} aria-label={`Remove ${i.file.name}`} className="rounded-full p-1 text-dim hover:text-danger"><X className="size-4" /></button>
          </li>)}</ul>
        </>}
      </aside>
      <section aria-live="polite" className="min-w-0 space-y-4">
        {!active ? <div className="card-line grid min-h-80 place-items-center rounded-2xl bg-panel text-center text-dim"><div><FileSearch className="mx-auto mb-3 size-9 text-acid" /><p>Add a file to begin an evidence-based inspection.</p></div></div> : <>
          <div className="card-line overflow-hidden rounded-2xl bg-panel">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="min-w-0"><h2 className="truncate font-medium">{active.file.name}</h2><p className="text-xs text-dim">{formatBytes(active.file.size)} · {active.file.type || "type unknown"}</p></div>{result && <button type="button" onClick={() => downloadBlob(reportBlob(result), withExtension(active.file.name, "provenance.json"))} className="inline-flex items-center gap-2 rounded-full border border-ink/20 px-4 py-2 text-xs hover:border-acid/50"><ArrowDownToLine className="size-4" /> Export JSON</button>}</div>
            {active.file.type.startsWith("image/") ? <div className="grid max-h-80 place-items-center border-t border-ink/10 bg-void p-4"><img src={active.url} alt={`Original: ${active.file.name}`} className="max-h-72 max-w-full object-contain" /></div> : active.file.type.startsWith("video/") ? <video src={active.url} controls preload="metadata" className="max-h-80 w-full bg-black" aria-label={`Original: ${active.file.name}`} /> : <p className="border-t border-ink/10 p-4 text-xs text-dim">This browser cannot preview this file; the C2PA reader may still inspect it.</p>}
          </div>
          {result ? <>
            <div className="card-line rounded-2xl bg-panel p-5"><div className={`flex items-center gap-2 text-sm font-semibold ${badge?.color}`}>{badge && <badge.icon className="size-5" />}{badge?.label}</div><p className="mt-2 text-sm leading-relaxed text-dim">{result.summary}</p><p className="mt-3 rounded-lg bg-warn/5 p-3 text-xs text-warn">SynthID: verification unavailable. C2PA and EXIF inspection cannot establish whether an invisible pixel/frame watermark is present or absent.</p></div>
            {result.manifestCount > 0 && <div className="card-line rounded-2xl bg-panel p-5"><h3 className="font-display font-semibold">Content Credentials</h3><dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2"><div><dt className="text-faint">Active manifest</dt><dd className="break-all text-ink">{result.activeLabel ?? "Unknown"}</dd></div><div><dt className="text-faint">Claim generator</dt><dd>{result.generator ?? "Unspecified"}</dd></div><div><dt className="text-faint">Manifest count</dt><dd>{result.manifestCount}</dd></div><div><dt className="text-faint">AI-origin assertions</dt><dd>{result.metadataHints.length ? result.metadataHints.join(", ") : "No recognized assertion; not proof of absence"}</dd></div></dl></div>}
            {result.validation.length > 0 && <div className="rounded-2xl border border-danger/30 bg-danger/5 p-5"><h3 className="font-semibold text-danger">Validation findings</h3><ul className="mt-3 space-y-2 text-xs text-dim">{result.validation.map((v,i) => <li key={i}><strong className="text-ink">{v.code}</strong> — {v.explanation}</li>)}</ul></div>}
            {result.history.length > 0 && <details className="card-line rounded-2xl bg-panel p-5" open><summary className="cursor-pointer font-display font-semibold">Provenance history · {result.history.length} manifest(s)</summary><ol className="mt-4 space-y-3">{result.history.map(h => <li key={h.label} className="rounded-xl bg-panel2 p-3 text-xs"><p className="break-all font-mono text-acid">{h.label}</p><p className="mt-1 text-dim">{h.title || "Untitled"} · {h.generator || "Unknown creator"} · {h.ingredients} ingredient(s)</p></li>)}</ol></details>}
            {result.assertions.length > 0 && <details className="card-line rounded-2xl bg-panel p-5"><summary className="cursor-pointer font-display font-semibold">Active assertions · {result.assertions.length}</summary><div className="mt-4 space-y-3">{result.assertions.map((a,i) => <details key={i} className="rounded-xl bg-panel2 p-3"><summary className="break-all text-xs">{a.label}</summary><pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-[0.65rem] text-dim">{a.data}</pre></details>)}</div></details>}
          </> : <p className="rounded-xl border border-ink/10 bg-panel p-4 text-sm text-dim">Ready to inspect. The original is not changed or transmitted.</p>}
        </>}
      </section>
    </div>
    </section>
    <section id="metadata-privacy" aria-labelledby="metadata-privacy-heading" className="mt-7 rounded-2xl border border-ink/10 bg-panel p-5 sm:p-6">
      <p className="kicker">02 · personal metadata · on-device</p>
      <h2 id="metadata-privacy-heading" className="font-display mt-2 flex items-center gap-2 text-lg font-semibold">
        <FileSearch className="size-5 text-acid" /> Metadata & Privacy
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-dim">
        Inspect camera and location data or selectively remove supported private JPEG EXIF fields such as GPS and device serials.
        This is not a SynthID check or a way to erase signed AI-origin records.
      </p>
      <Link href="/metadata" className="mt-4 inline-flex items-center gap-2 rounded-full border border-acid/40 px-4 py-2 text-xs font-semibold text-acid hover:bg-acid/10">
        Open Metadata & Privacy <ArrowUpRight className="size-4" />
      </Link>
    </section>
  </WorkspaceShell>;
}
