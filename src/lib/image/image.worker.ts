/// <reference lib="webworker" />
/**
 * Image processing worker.
 * Decodes → resizes → re-encodes entirely off the main thread.
 * Re-encoding through a canvas strips ALL metadata (EXIF/XMP/ICC) by construction:
 * only raw pixels survive the round-trip.
 */
import UTIF from "utif2";
import {
  FORMAT_EXT,
  FORMAT_MIME,
  type ImageJobRequest,
  type ImageJobResult,
  type WorkerOutMessage,
} from "./types";

declare const self: DedicatedWorkerGlobalScope;

const LOSSLESS = new Set(["image/png"]);

function post(msg: WorkerOutMessage) {
  self.postMessage(msg);
}

/** SVG has no intrinsic size in many encoders — sniff dimensions from markup. */
async function sniffSvgSize(blob: Blob): Promise<{ width: number; height: number } | null> {
  try {
    const text = await blob.text();
    const wMatch = text.match(/\bwidth\s*=\s*["']([\d.]+)(px)?["']/i);
    const hMatch = text.match(/\bheight\s*=\s*["']([\d.]+)(px)?["']/i);
    if (wMatch && hMatch) {
      return { width: parseFloat(wMatch[1]), height: parseFloat(hMatch[1]) };
    }
    const vb = text.match(/\bviewBox\s*=\s*["']\s*[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*["']/i);
    if (vb) return { width: parseFloat(vb[1]), height: parseFloat(vb[2]) };
  } catch {
    /* fall through */
  }
  return null;
}

async function decodeToBitmap(
  blob: Blob,
  warnings: string[]
): Promise<{ bitmap: ImageBitmap; width: number; height: number }> {
  const mime = blob.type.toLowerCase();

  if (mime === "image/tiff" || mime === "image/tif" || /\.tiff?$/i.test((blob as File).name ?? "")) {
    const buf = await blob.arrayBuffer();
    const ifds = UTIF.decode(buf);
    if (!ifds.length) throw new Error("No decodable image found inside the TIFF file.");
    const page = ifds[0];
    UTIF.decodeImage(buf, page);
    const rgba = UTIF.toRGBA8(page);
    const width = page.width;
    const height = page.height;
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d")!;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
    const bitmap = canvas.transferToImageBitmap();
    if (ifds.length > 1) warnings.push(`Multi-page TIFF: only page 1 of ${ifds.length} was processed.`);
    return { bitmap, width, height };
  }

  if (mime === "image/svg+xml") {
    const size = await sniffSvgSize(blob);
    const opts =
      size && size.width > 0 && size.height > 0
        ? { resizeWidth: Math.round(size.width), resizeHeight: Math.round(size.height), resizeQuality: "high" as ResizeQuality }
        : undefined;
    const bitmap = await createImageBitmap(blob, opts);
    warnings.push("SVG was rasterized — the output is a bitmap, not a vector image.");
    return { bitmap, width: bitmap.width, height: bitmap.height };
  }

  if (mime === "image/gif") {
    warnings.push("GIF is decoded to its first frame — animation is not preserved by this pipeline.");
  }

  const bitmap = await createImageBitmap(blob);
  return { bitmap, width: bitmap.width, height: bitmap.height };
}

function targetSize(
  srcW: number,
  srcH: number,
  scalePercent: number,
  maxDimension: number
): { w: number; h: number } {
  let w = Math.max(1, Math.round((srcW * scalePercent) / 100));
  let h = Math.max(1, Math.round((srcH * scalePercent) / 100));
  if (maxDimension > 0) {
    const longest = Math.max(w, h);
    if (longest > maxDimension) {
      const ratio = maxDimension / longest;
      w = Math.max(1, Math.round(w * ratio));
      h = Math.max(1, Math.round(h * ratio));
    }
  }
  return { w, h };
}

async function processJob(job: ImageJobRequest): Promise<ImageJobResult> {
  const started = performance.now();
  const warnings: string[] = [];
  const { settings } = job;

  const { bitmap, width: srcW, height: srcH } = await decodeToBitmap(job.file, warnings);

  const srcMime = job.file.type.toLowerCase();
  let targetMime: string;
  if (settings.format === "original") {
    const srcKey = (Object.keys(FORMAT_MIME) as Array<keyof typeof FORMAT_MIME>).find(
      (k) => FORMAT_MIME[k] === srcMime
    );
    if (srcKey) {
      targetMime = FORMAT_MIME[srcKey];
    } else {
      targetMime = "image/png";
      warnings.push(`"${srcMime || "unknown"}" cannot be re-encoded by the browser — exported as PNG instead.`);
    }
  } else {
    targetMime = FORMAT_MIME[settings.format];
  }

  if (LOSSLESS.has(targetMime) && settings.quality < 1) {
    warnings.push("PNG is lossless — the quality slider had no effect.");
  }

  const crop = settings.crop;
  const sx = Math.min(srcW - 1, Math.max(0, Math.floor(srcW * crop.x / 100)));
  const sy = Math.min(srcH - 1, Math.max(0, Math.floor(srcH * crop.y / 100)));
  const sw = Math.max(1, Math.min(srcW - sx, Math.round(srcW * crop.width / 100)));
  const sh = Math.max(1, Math.min(srcH - sy, Math.round(srcH * crop.height / 100)));
  const { w, h } = targetSize(sw, sh, settings.scalePercent, settings.maxDimension);
  const rotated = settings.rotation === 90 || settings.rotation === 270;
  const outW = rotated ? h : w;
  const outH = rotated ? w : h;
  post({ type: "progress", id: job.id, progress: 0.45 });

  const canvas = new OffscreenCanvas(outW, outH);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not acquire a 2D canvas context in the worker.");

  const opaque = targetMime === "image/jpeg";
  if (opaque) {
    ctx.fillStyle = settings.alphaFill || "#ffffff";
    ctx.fillRect(0, 0, outW, outH);
    warnings.push("JPEG has no alpha channel — transparency was flattened onto the chosen background.");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.translate(outW / 2, outH / 2);
  ctx.rotate(settings.rotation * Math.PI / 180);
  ctx.drawImage(bitmap, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
  bitmap.close();

  post({ type: "progress", id: job.id, progress: 0.75 });

  const quality = LOSSLESS.has(targetMime) ? undefined : settings.quality;
  const blob = await canvas.convertToBlob({ type: targetMime, quality });
  if (!blob) throw new Error("The encoder returned no data.");
  if (blob.type !== targetMime) {
    throw new Error(`This browser cannot encode ${targetMime}. Choose another format.`);
  }

  const ext = (Object.keys(FORMAT_EXT) as Array<keyof typeof FORMAT_EXT>).find(
    (k) => FORMAT_MIME[k] === targetMime
  );

  return {
    id: job.id,
    ok: true,
    blob,
    outMime: targetMime,
    outExt: ext ? FORMAT_EXT[ext] : "png",
    width: outW,
    height: outH,
    srcWidth: srcW,
    srcHeight: srcH,
    warnings,
    durationMs: Math.round(performance.now() - started),
  };
}

self.onmessage = async (e: MessageEvent<ImageJobRequest>) => {
  const job = e.data;
  post({ type: "progress", id: job.id, progress: 0.1 });
  try {
    const result = await processJob(job);
    post({ type: "result", ...result });
  } catch (err) {
    post({
      type: "result",
      id: job.id,
      ok: false,
      warnings: [],
      error: err instanceof Error ? err.message : "Unknown processing error",
      durationMs: 0,
    });
  }
};

export {};
