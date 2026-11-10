/**
 * Lazy singleton wrapper around FFmpeg.wasm.
 * The ~31MB core is vendored same-origin under /ffmpeg/ — no CDN calls, no telemetry.
 */
import { FFmpeg } from "@ffmpeg/ffmpeg";

let ffmpeg: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;

let progressHandler: ((p: FfmpegProgress) => void) | null = null;
let currentDuration: number | undefined;
let generation = 0;

export interface FfmpegProgress {
  /** 0..1 ratio derived from output timestamp vs. probed duration */
  ratio: number;
  /** seconds of media written so far */
  seconds: number;
}

async function createInstance(): Promise<FFmpeg> {
  const instance = new FFmpeg();
  const startedAt = generation;
  // one listener for the life of the instance; the active job swaps the handler
  instance.on("progress", ({ time }) => {
    const seconds = time / 1_000_000;
    const ratio = currentDuration && currentDuration > 0 ? Math.min(1, seconds / currentDuration) : 0;
    progressHandler?.({ ratio, seconds });
  });
  try {
    await instance.load({ coreURL: "/ffmpeg/ffmpeg-core.js", wasmURL: "/ffmpeg/ffmpeg-core.wasm" });
    if (startedAt !== generation) throw new Error("FFmpeg loading cancelled");
    return instance;
  } catch (error) {
    instance.terminate();
    throw error;
  }
}

export async function getFFmpeg(
  onProgress?: (p: FfmpegProgress) => void,
  durationSec?: number
): Promise<FFmpeg> {
  progressHandler = onProgress ?? null;
  currentDuration = durationSec;
  if (ffmpeg) return ffmpeg;
  if (!loading) loading = createInstance();
  const task = loading;
  try {
    const loaded = await task;
    if (task !== loading) { loaded.terminate(); throw new Error("FFmpeg loading cancelled"); }
    ffmpeg = loaded;
    return loaded;
  } finally {
    if (loading === task) loading = null;
  }
}

/** Hard-cancel: kills the WASM thread. Next run reloads the engine cleanly. */
export function terminateFFmpeg() {
  generation += 1;
  try {
    ffmpeg?.terminate();
  } catch {
    /* already gone */
  }
  ffmpeg = null;
  loading = null;
  progressHandler = null;
  currentDuration = undefined;
}

export function isFFmpegLoaded() {
  return ffmpeg !== null;
}
