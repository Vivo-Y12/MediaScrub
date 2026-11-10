/** Shared contracts between the image workspace and the processing worker. */

export type OutputFormat = "original" | "png" | "jpeg" | "webp" | "avif";

export const FORMAT_MIME: Record<Exclude<OutputFormat, "original">, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif",
};

export const FORMAT_EXT: Record<Exclude<OutputFormat, "original">, string> = {
  png: "png",
  jpeg: "jpg",
  webp: "webp",
  avif: "avif",
};

export interface ImageSettings {
  /** Target container format. "original" keeps the source format when encodable. */
  format: OutputFormat;
  /** 0..1 — applies to lossy encoders (jpeg/webp/avif). PNG ignores it (lossless). */
  quality: number;
  /** Uniform scale percentage (100 = unchanged). */
  scalePercent: number;
  /** Longest-edge box constraint; 0 disables. */
  maxDimension: number;
  /** Fill color for alpha channels when encoding to opaque formats (jpeg). null = keep as-is. */
  alphaFill: string;
  /** Canvas re-encode always strips EXIF/XMP; kept as explicit flag for honesty in the UI. */
  stripMetadata: boolean;
  /** Clockwise rotation applied after cropping. */
  rotation: 0 | 90 | 180 | 270;
  /** Crop rectangle in source percentages. */
  crop: { x: number; y: number; width: number; height: number };
}

export const DEFAULT_IMAGE_SETTINGS: ImageSettings = {
  format: "webp",
  quality: 0.82,
  scalePercent: 100,
  maxDimension: 0,
  alphaFill: "#ffffff",
  stripMetadata: true,
  rotation: 0,
  crop: { x: 0, y: 0, width: 100, height: 100 },
};

export interface ImageJobRequest {
  id: string;
  file: Blob;
  fileName: string;
  sourceSize: number;
  settings: ImageSettings;
}

export type JobStatus = "queued" | "processing" | "done" | "error" | "cancelled";

export interface ImageJobResult {
  id: string;
  ok: boolean;
  blob?: Blob;
  outMime?: string;
  outExt?: string;
  width?: number;
  height?: number;
  srcWidth?: number;
  srcHeight?: number;
  warnings: string[];
  error?: string;
  durationMs: number;
}

/** Messages worker -> main */
export type WorkerOutMessage =
  | { type: "progress"; id: string; progress: number }
  | ({ type: "result" } & ImageJobResult);
