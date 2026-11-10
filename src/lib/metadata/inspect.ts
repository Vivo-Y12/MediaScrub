/**
 * Metadata inspection — images via exifr, containers via magic-byte + box parsing.
 * All reads are local arrayBuffer reads; nothing is transmitted anywhere.
 */
import * as exifr from "exifr";
import { formatBytes } from "@/lib/utils";

export interface MetaSection {
  title: string;
  icon: "file" | "camera" | "geo" | "provenance" | "container" | "other";
  entries: { key: string; value: string }[];
}

export interface Inspection {
  fileName: string;
  fileSize: number;
  mime: string;
  sections: MetaSection[];
  gps: { lat: number; lon: number } | null;
  hasProvenanceHints: boolean;
  provenanceNotes: string[];
  raw: Record<string, unknown>;
  error?: string;
}

const PRETTY_KEYS: Record<string, string> = {
  Make: "Camera make",
  Model: "Camera model",
  LensModel: "Lens",
  Software: "Software",
  DateTimeOriginal: "Taken at",
  CreateDate: "Created",
  ModifyDate: "Modified",
  ISO: "ISO",
  FNumber: "Aperture",
  ExposureTime: "Shutter",
  FocalLength: "Focal length",
  FocalLengthIn35mmFormat: "Focal (35mm eq.)",
  Orientation: "Orientation",
  WhiteBalance: "White balance",
  Flash: "Flash",
  ImageWidth: "Width",
  ImageHeight: "Height",
  ExifImageWidth: "Width",
  ExifImageHeight: "Height",
  ColorSpace: "Color space",
  XResolution: "X resolution",
  YResolution: "Y resolution",
  ResolutionUnit: "Resolution unit",
  Artist: "Artist",
  Copyright: "Copyright",
  UserComment: "User comment",
  ImageDescription: "Description",
  HostComputer: "Host computer",
};

const PROVENANCE_KEY_HINTS = [/c2pa/i, /contentauth/i, /jumbf/i, /credentials?/i, /^ai(?:generated|model|tool|prompt|origin)/i, /digitalSourceType/i, /trainedAlgorithmic/i, /synthid/i, /manifest/i];

function fmtValue(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(4);
  if (typeof v === "string") return v.length > 400 ? v.slice(0, 400) + "…" : v;
  if (Array.isArray(v)) return v.slice(0, 8).map(fmtValue).join(", ") + (v.length > 8 ? "…" : "");
  if (typeof v === "object") {
    try {
      const s = JSON.stringify(v);
      return s.length > 200 ? s.slice(0, 200) + "…" : s;
    } catch {
      return "[complex value]";
    }
  }
  return String(v);
}

/** Walk top-level MP4/MOV boxes + mvhd timestamps — no dependencies, no engine load. */
export async function sniffContainer(buf: ArrayBuffer): Promise<MetaSection | null> {
  const bytes = new Uint8Array(buf);
  if (bytes.length < 12) return null;
  const fourCC = (o: number) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);

  // ISO-BMFF (mp4/mov): ftyp
  if (bytes.length >= 16 && fourCC(4) === "ftyp") {
    const major = fourCC(8);
    const minor = new DataView(buf).getUint32(12);
    const brands: string[] = [];
    let off = 16;
    while (off + 4 <= Math.min(bytes.length, 64)) {
      const b = fourCC(off).trim();
      if (b) brands.push(b);
      off += 4;
    }
    const entries = [
      { key: "Container", value: major === "qt  " ? "QuickTime (MOV)" : "ISO-BMFF (MP4 family)" },
      { key: "Major brand", value: `${major.trim()} v${minor}` },
      { key: "Compatible brands", value: brands.slice(0, 6).join(", ") || "—" },
    ];

    // ISO-BMFF movie header lives inside moov; walk bounded nested boxes without scanning arbitrary payload bytes.
    const limit = Math.min(bytes.length, 8 * 1024 * 1024);
    const dv = new DataView(buf);
    const ranges: Array<{ start: number; end: number; depth: number }> = [{ start: 0, end: limit, depth: 0 }];
    let found = false;
    while (ranges.length && !found) {
      const { start, end, depth } = ranges.shift()!;
      let i = start;
      while (i + 8 <= end && !found) {
        let size = dv.getUint32(i);
        const type = fourCC(i + 4);
        const header = size === 1 ? 16 : 8;
        if (size === 1) {
          if (i + 16 > end) break;
          const bigSize = dv.getBigUint64(i + 8);
          if (bigSize > BigInt(Number.MAX_SAFE_INTEGER)) break;
          size = Number(bigSize);
        }
        if (size === 0) size = end - i;
        if (size < header || i + size > end) break;
        if (type === "moov" && depth === 0) ranges.push({ start: i + header, end: i + size, depth: 1 });
        if (type === "mvhd" && depth === 1 && size >= (bytes[i + header] === 1 ? 44 : 32)) {
          const version = bytes[i + header];
          const offset = i + header + 4;
          const epoch = Date.UTC(1904, 0, 1);
          const created = version === 1 ? Number(dv.getBigUint64(offset)) : dv.getUint32(offset);
          const modified = version === 1 ? Number(dv.getBigUint64(offset + 8)) : dv.getUint32(offset + 4);
          const timescale = dv.getUint32(offset + (version === 1 ? 16 : 8));
          const duration = version === 1 ? Number(dv.getBigUint64(offset + 20)) : dv.getUint32(offset + 12);
          if (created > 0) entries.push({ key: "Created (mvhd)", value: new Date(epoch + created * 1000).toISOString() });
          if (modified > 0) entries.push({ key: "Modified (mvhd)", value: new Date(epoch + modified * 1000).toISOString() });
          if (timescale > 0) entries.push({ key: "Duration", value: `${(duration / timescale).toFixed(2)} s` });
          found = true;
        }
        i += size;
      }
    }
    return { title: "Container", icon: "container", entries };
  }

  // EBML → WebM / MKV
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    const head = new TextDecoder().decode(bytes.slice(0, 512));
    return {
      title: "Container",
      icon: "container",
      entries: [
        { key: "Container", value: "EBML (Matroska/WebM)" },
        { key: "Doc type", value: head.includes("webm") ? "webm" : head.includes("matroska") ? "matroska" : "unknown EBML" },
        { key: "Note", value: "Deep EBML parsing is not bundled — use the Video lab for full stream data." },
      ],
    };
  }

  // RIFF → AVI
  if (fourCC(0) === "RIFF" && fourCC(8) === "AVI ") {
    return { title: "Container", icon: "container", entries: [{ key: "Container", value: "RIFF / AVI" }] };
  }
  return null;
}

export async function inspectFile(file: File): Promise<Inspection> {
  const base: Inspection = {
    fileName: file.name,
    fileSize: file.size,
    mime: file.type || "unknown",
    sections: [],
    gps: null,
    hasProvenanceHints: false,
    provenanceNotes: [],
    raw: {},
  };

  const fileSection: MetaSection = {
    title: "File",
    icon: "file",
    entries: [
      { key: "Name", value: file.name },
      { key: "Size", value: formatBytes(file.size) },
      { key: "MIME", value: file.type || "unknown" },
      { key: "Last modified", value: new Date(file.lastModified).toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC") },
    ],
  };
  base.sections.push(fileSection);

  const isImage = file.type.startsWith("image/");

  if (isImage) {
    try {
      const data = await exifr.parse(file, {
        tiff: true,
        ifd0: {},
        exif: true,
        gps: true,
        xmp: true,
        icc: true,
        iptc: true,
        jfif: true,
        reviveValues: true,
        mergeOutput: true,
        sanitize: true,
        translateKeys: true,
        translateValues: true,
      });
      if (data && typeof data === "object") {
        base.raw = data as Record<string, unknown>;
        const camera: MetaSection = { title: "Camera & capture", icon: "camera", entries: [] };
        const other: MetaSection = { title: "Other embedded fields", icon: "other", entries: [] };
        const prov: MetaSection = { title: "Provenance & XMP", icon: "provenance", entries: [] };

        for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
          if (v == null || k === "latitude" || k === "longitude") continue;
          const pretty = PRETTY_KEYS[k] ?? k;
          const entry = { key: pretty, value: fmtValue(v) };
          if (!entry.value) continue;
          if (PRETTY_KEYS[k]) camera.entries.push(entry);
          else if (PROVENANCE_KEY_HINTS.some((r) => r.test(k))) prov.entries.push({ key: k, value: entry.value });
          else other.entries.push(entry);
        }

        if (camera.entries.length) base.sections.push(camera);
        if (prov.entries.length) {
          base.hasProvenanceHints = true;
          base.sections.push(prov);
        }
        if (other.entries.length) base.sections.push(other);
      } else {
        base.sections.push({
          title: "Embedded metadata",
          icon: "other",
          entries: [{ key: "Result", value: "No readable EXIF/XMP blocks found in this file." }],
        });
      }

      try {
        const gps = await exifr.gps(file);
        if (gps && typeof gps.latitude === "number" && typeof gps.longitude === "number") {
          base.gps = { lat: gps.latitude, lon: gps.longitude };
          base.sections.push({
            title: "GPS",
            icon: "geo",
            entries: [
              { key: "Latitude", value: gps.latitude.toFixed(6) },
              { key: "Longitude", value: gps.longitude.toFixed(6) },
              { key: "Map link", value: `https://www.openstreetmap.org/?mlat=${gps.latitude.toFixed(6)}&mlon=${gps.longitude.toFixed(6)}#map=15/${gps.latitude.toFixed(6)}/${gps.longitude.toFixed(6)}` },
            ],
          });
        }
      } catch {
        /* no gps */
      }
    } catch (err) {
      base.error = err instanceof Error ? err.message : "Could not parse image metadata.";
    }
  } else {
    // media container sniff for video/audio files
    try {
      const head = await file.slice(0, 8 * 1024 * 1024).arrayBuffer();
      const container = await sniffContainer(head);
      if (container) base.sections.push(container);
      else
        base.sections.push({
          title: "Container",
          icon: "container",
          entries: [{ key: "Container", value: "Unrecognized header — deep probing not available for this type." }],
        });
    } catch (err) {
      base.error = err instanceof Error ? err.message : "Could not read container header.";
    }
  }

  if (base.hasProvenanceHints) {
    base.provenanceNotes.push(
      "This file contains XMP/metadata fields that look like provenance records (e.g. Content Credentials).",
      "Re-encoding pixels strips metadata blocks, but cryptographic provenance cannot be forged or 'verified away' — absence of metadata is not proof of human origin.",
      "Pixel-level watermarks (e.g. SynthID) live in the image data itself and are NOT detectable or removable by this tool."
    );
  } else {
    base.provenanceNotes.push(
      "No obvious provenance metadata detected. That does NOT prove no watermark exists — invisible watermarks live in pixels, not metadata.",
      "This tool never claims to remove or verify hidden AI-origin signals."
    );
  }
  return base;
}

/** Serialize an inspection into a downloadable JSON blob. */
export function inspectionToJsonBlob(r: Inspection): Blob {
  return new Blob(
    [
      JSON.stringify(
        { tool: "MediaScrub metadata inspector", inspectedAt: new Date().toISOString(), ...r },
        (_k, v) => (typeof v === "bigint" ? String(v) : v instanceof Date ? v.toISOString() : v),
        2
      ),
    ],
    { type: "application/json" }
  );
}
