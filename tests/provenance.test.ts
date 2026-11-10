import { describe, expect, it } from "vitest";
import { classifyStore, provenanceFormat, summarizeStore } from "@/lib/provenance/inspect";
import type { ManifestStore } from "@contentauth/c2pa-types";
import { buildArgs, DEFAULT_VIDEO_SETTINGS } from "@/lib/video/operations";
import { sniffContainer } from "@/lib/metadata/inspect";

describe("provenance classification is evidence-based", () => {
  it("does not imply no SynthID from missing C2PA", () => {
    expect(classifyStore(null)).toBe("not-detected");
    expect(summarizeStore(null)).toContain("does not establish human origin");
  });
  it("separates signature validity, trust and errors", () => {
    expect(classifyStore({ validation_state: "Valid" } as ManifestStore)).toBe("valid");
    expect(classifyStore({ validation_state: "Trusted" } as ManifestStore)).toBe("trusted");
    expect(classifyStore({ validation_state: "Invalid" } as ManifestStore)).toBe("invalid");
    expect(classifyStore({ manifests: { one: {} } } as ManifestStore)).toBe("unavailable");
  });
  it("does not infer unknown extensions as supported", () => {
    expect(provenanceFormat({ name: "file.jpg", type: "" })).toBe("image/jpeg");
    expect(provenanceFormat({ name: "file.exe", type: "application/octet-stream" })).toBeNull();
  });
});

describe("real operation builders", () => {
  it("trims by timestamp with valid args", () => {
    const args = buildArgs("in.webm", "out.webm", { ...DEFAULT_VIDEO_SETTINGS, operation: "trim", target: "webm", trimStart: 1.5, trimEnd: 3.5 });
    expect(args.join(" ")).toContain("-ss 1.5 -t 2");
    expect(args.at(-1)).toBe("out.webm");
  });
  it("rejects impossible clip bounds", () => {
    expect(() => buildArgs("i", "o", { ...DEFAULT_VIDEO_SETTINGS, operation: "trim", trimStart: 5, trimEnd: 4 })).toThrow("Trim end");
  });
  it("reads movie duration from nested moov/mvhd", async () => {
    const out = new Uint8Array(64); const dv = new DataView(out.buffer);
    const box = (o: number, n: number, tag: string) => { dv.setUint32(o, n); for (let i = 0; i < 4; i++) out[o + 4 + i] = tag.charCodeAt(i); };
    box(0, 16, "ftyp"); box(16, 48, "moov"); box(24, 40, "mvhd");
    out.set(new TextEncoder().encode("isom"), 8);
    dv.setUint32(36, 1); dv.setUint32(40, 2); dv.setUint32(44, 1000); dv.setUint32(48, 2500);
    const section = await sniffContainer(out.buffer);
    expect(section?.entries.find(e => e.key === "Duration")?.value).toBe("2.50 s");
  });
});
