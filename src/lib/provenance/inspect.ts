import type { ManifestStore } from "@contentauth/c2pa-types";
import { inspectFile } from "@/lib/metadata/inspect";
import { sniffProvenanceFormat } from "./format";

export type ProvenanceState = "valid" | "trusted" | "invalid" | "not-detected" | "unsupported" | "unavailable";
export interface ProvenanceReport {
  fileName: string;
  fileSize: number;
  format: string;
  state: ProvenanceState;
  summary: string;
  synthId: "verification-unavailable";
  manifestCount: number;
  activeLabel: string | null;
  generator: string | null;
  assertions: { label: string; data: string }[];
  history: { label: string; title: string | null; generator: string | null; ingredients: number }[];
  validation: { code: string; explanation: string }[];
  metadataHints: string[];
  store?: ManifestStore;
}

const FORMATS: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  gif: "image/gif", tiff: "image/tiff", tif: "image/tiff", avif: "image/avif",
  svg: "image/svg+xml", mp4: "video/mp4", mov: "video/quicktime", m4v: "video/mp4",
  webm: "video/webm", avi: "video/x-msvideo", mkv: "video/x-matroska",
};

export function provenanceFormat(file: Pick<File, "name" | "type">): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return FORMATS[ext] ?? (Object.values(FORMATS).includes(file.type) ? file.type : null);
}

export function classifyStore(store: ManifestStore | null): ProvenanceState {
  if (!store) return "not-detected";
  // Do not equate an unrecognized/unknown validation state with successful verification.
  if (store.validation_state === "Trusted") return "trusted";
  if (store.validation_state === "Valid") return "valid";
  if (store.validation_state === "Invalid" || (store.validation_status?.length ?? 0) > 0) return "invalid";
  return "unavailable";
}

export function summarizeStore(store: ManifestStore | null): string {
  const state = classifyStore(store);
  switch (state) {
    case "trusted": return "C2PA manifest verified with a trusted signing chain.";
    case "valid": return "C2PA manifest has valid structure and signature; signer identity was not trust-validated offline.";
    case "invalid": return "A C2PA manifest was found but validation reported an error. Do not treat its claims as verified.";
    case "not-detected": return "No embedded C2PA manifest was detected by the supported reader. This does not establish human origin.";
    default: return "C2PA verification could not be established. No conclusion about provenance is possible.";
  }
}

let sdkPromise: ReturnType<typeof import("@contentauth/c2pa-web")["createC2pa"]> | null = null;
async function sdk() {
  if (!sdkPromise) {
    sdkPromise = import("@contentauth/c2pa-web").then(({ createC2pa }) => createC2pa({
      wasmSrc: "/c2pa/c2pa_bg.wasm",
    })).catch((error) => { sdkPromise = null; throw error; });
  }
  return sdkPromise;
}

/** No media upload, external trust list or remote-manifest fetch. All reads happen in a local WASM worker. */
export async function inspectProvenance(file: File): Promise<ProvenanceReport> {
  const base: ProvenanceReport = {
    fileName: file.name, fileSize: file.size, format: file.type || "unknown",
    state: "unavailable", summary: "Verification unavailable.", synthId: "verification-unavailable",
    manifestCount: 0, activeLabel: null, generator: null, assertions: [], history: [], validation: [], metadataHints: [],
  };
  let detected: string | null;
  try {
    detected = await sniffProvenanceFormat(file);
  } catch {
    return { ...base, summary: "Could not read the file header to determine its format. Verification is unavailable." };
  }
  // A filename/MIME type is only a fallback hint. A signed JPEG/MP4 renamed .webm
  // must be inspected as its actual content, not treated as an unsupported WebM.
  const format = detected ?? provenanceFormat(file);
  base.format = format ?? file.type ?? "unknown";
  if (!format) return { ...base, state: "unsupported", summary: "This format is not supported by the local C2PA reader." };
  // The pinned C2PA SDK currently throws UnsupportedType for WebM. State this before loading WASM;
  // never conflate a container that cannot be inspected with an inspected file lacking credentials.
  if (format === "video/webm") return { ...base, state: "unsupported", summary: "Embedded C2PA inspection is unsupported for WebM in the pinned reader; no conclusion about provenance can be drawn." };
  if (file.size > 1024 * 1024 * 1024) return { ...base, summary: "File exceeds the 1 GB local C2PA reader limit." };

  try {
    const { Reader, Context } = await import("@contentauth/c2pa-web");
    const reader = await Reader.fromBlob(await sdk(), format, file, new Context({
      verify: { verifyTrust: false, remoteManifestFetch: false, ocspFetch: false },
    }));
    if (!reader) return { ...base, state: "not-detected", summary: summarizeStore(null) };
    try {
      const store = await reader.manifestStore();
      const state = classifyStore(store);
      const manifests = Object.entries(store.manifests ?? {});
      const active = store.active_manifest ? store.manifests?.[store.active_manifest] : undefined;
      const activeAssertions = active?.assertions ?? [];
      const hints = activeAssertions.filter(a => /digitalSourceType|trainedAlgorithmicMedia|ai.generated|generative/i.test(JSON.stringify(a))).map(a => a.label ?? "AI-origin assertion");
      return {
        ...base, state, summary: summarizeStore(store), store,
        manifestCount: manifests.length, activeLabel: store.active_manifest ?? null,
        generator: active?.claim_generator ?? active?.claim_generator_info?.[0]?.name ?? null,
        history: manifests.map(([label, m]) => ({ label, title: m.title ?? null, generator: m.claim_generator ?? null, ingredients: m.ingredients?.length ?? 0 })),
        assertions: activeAssertions.map(a => ({ label: a.label ?? "Assertion", data: JSON.stringify(a.data ?? a, null, 2).slice(0, 2000) })),
        validation: (store.validation_status ?? []).map(s => ({ code: s.code ?? "unknown", explanation: s.explanation ?? "" })),
        metadataHints: hints,
      };
    } finally {
      await reader.free();
    }
  } catch (error) {
    if (error instanceof Error && /UnsupportedType/.test(error.message)) {
      return { ...base, state: "unsupported", summary: "The local C2PA reader does not support embedded credentials in this container. No negative provenance conclusion can be drawn." };
    }
    return { ...base, summary: `C2PA verification unavailable: ${error instanceof Error ? error.message : "reader error"}` };
  }
}

/** Fail closed: pixel re-encoding/remuxing may break or discard signed credentials. */
export async function assertNoSignedProvenance(file: File): Promise<void> {
  const result = await inspectProvenance(file);
  // The current C2PA SDK does not support embedded C2PA in WebM. This is NOT a negative inspection;
  // ordinary WebM transcoding remains available, while we label the limitation in the UI/docs.
  if (result.state === "unsupported" && result.format === "video/webm"
      && await sniffProvenanceFormat(file) === "video/webm") return;
  if (result.state === "not-detected" && file.type.startsWith("image/")) {
    const metadata = await inspectFile(file);
    if (metadata.error) throw new Error("Could not inspect image metadata; destructive processing is paused to protect possible provenance.");
    if (metadata.hasProvenanceHints) throw new Error("Possible AI-origin/provenance metadata found. Processing paused so it is not silently discarded; inspect this file in Provenance.");
  }
  if (result.state !== "not-detected") {
    throw new Error(`Processing paused to protect provenance (${result.state}). Inspect this file in Provenance. Only media with a completed no-manifest C2PA inspection can be processed here.`);
  }
}

export function reportBlob(report: ProvenanceReport): Blob {
  return new Blob([JSON.stringify({ tool: "MediaScrub provenance inspector", inspectedAt: new Date().toISOString(), ...report }, null, 2)], { type: "application/json" });
}
