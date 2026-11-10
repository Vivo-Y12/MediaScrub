/**
 * Metadata removal, honestly implemented:
 * - Images: full pixel re-encode (every metadata block is dropped by construction).
 * - Video: FFmpeg stream-copy with -map_metadata -1 (container tags removed, streams untouched).
 */
import { ImageProcessor, type ImageRunResult } from "@/lib/image/processor";
import { getFFmpeg } from "@/lib/video/ffmpeg";
import { uid } from "@/lib/utils";

export async function stripImageMetadata(
  file: File,
  processor: ImageProcessor
): Promise<ImageRunResult> {
  const { promise } = processor.process(file, {
    format: "original",
    quality: 0.95,
    scalePercent: 100,
    maxDimension: 0,
    alphaFill: "#ffffff",
    stripMetadata: true,
    rotation: 0,
    crop: { x: 0, y: 0, width: 100, height: 100 },
  });
  return promise;
}

export async function stripVideoMetadata(file: File): Promise<Blob> {
  const ff = await getFFmpeg();
  const ext = (file.name.match(/\.([a-z0-9]+)$/i)?.[1] ?? "mp4").toLowerCase();
  const jobId = uid("strip");
  const inName = `${jobId}-in.${ext}`;
  const outName = `${jobId}-out.${ext}`;
  try {
    await ff.writeFile(inName, new Uint8Array(await file.arrayBuffer()));
    const code = await ff.exec(["-i", inName, "-map", "0", "-map_metadata", "-1", "-c", "copy", outName]);
    if (code !== 0) throw new Error("Metadata strip failed — container may not support lossless stream copy in this build.");
    const data = await ff.readFile(outName);
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
    return new Blob([new Uint8Array(bytes)], { type: file.type || "video/mp4" });
  } finally {
    // FFmpeg may leave a partial output after a failed encode or read.
    await ff.deleteFile(inName).catch(() => undefined);
    await ff.deleteFile(outName).catch(() => undefined);
  }
}
