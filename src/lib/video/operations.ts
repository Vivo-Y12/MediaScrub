/**
 * Pure builders for FFmpeg CLI argument lists.
 * Kept side-effect free so they can be unit-tested without a browser.
 */

export type VideoOperation =
  | "convert"
  | "compress"
  | "scale"
  | "gif"
  | "audio"
  | "thumbnails"
  | "trim";

export interface VideoSettings {
  operation: VideoOperation;
  /** convert/compress/scale target container */
  target: "mp4" | "webm";
  /** mp4 codec */
  mp4Codec: "libx264" | "mpeg4";
  /** webm codec */
  webmCodec: "libvpx-vp9" | "libvpx";
  crf: number; // 18..40-ish
  preset: "ultrafast" | "veryfast" | "fast" | "medium";
  scaleWidth: number; // 0 = keep
  includeAudio: boolean;
  /** gif */
  gifFps: number;
  gifWidth: number;
  /** audio */
  audioFormat: "mp3" | "wav" | "ogg";
  /** thumbnails */
  thumbCount: number;
  /** Trim start and end timestamps in seconds. End must be after start. */
  trimStart: number;
  trimEnd: number;
}

export const DEFAULT_VIDEO_SETTINGS: VideoSettings = {
  operation: "compress",
  target: "mp4",
  mp4Codec: "libx264",
  webmCodec: "libvpx-vp9",
  crf: 30,
  preset: "veryfast",
  scaleWidth: 0,
  includeAudio: true,
  gifFps: 10,
  gifWidth: 480,
  audioFormat: "mp3",
  thumbCount: 4,
  trimStart: 0,
  trimEnd: 10,
};

const AUDIO_CODEC_BY_FORMAT: Record<VideoSettings["audioFormat"], string[]> = {
  mp3: ["libmp3lame", "-q:a", "4"],
  wav: ["pcm_s16le"],
  ogg: ["libvorbis", "-q:a", "5"],
};

function videoCodecArgs(s: VideoSettings): string[] {
  if (s.target === "webm") {
    // vp9 single-pass CRF; vp8 uses bitrate
    return s.webmCodec === "libvpx-vp9"
      ? ["-c:v", "libvpx-vp9", "-crf", String(s.crf), "-b:v", "0", "-row-mt", "1"]
      : ["-c:v", "libvpx", "-crf", String(Math.min(s.crf, 32)), "-b:v", "1M"];
  }
  if (s.mp4Codec === "mpeg4") {
    return ["-c:v", "mpeg4", "-q:v", String(Math.max(2, Math.round((s.crf - 14) / 4)))];
  }
  return ["-c:v", "libx264", "-preset", s.preset, "-crf", String(s.crf), "-pix_fmt", "yuv420p"];
}

function audioArgs(s: VideoSettings): string[] {
  if (!s.includeAudio) return ["-an"];
  return s.target === "webm" ? ["-c:a", "libvorbis", "-q:a", "4"] : ["-c:a", "aac", "-b:a", "128k"];
}

/**
 * Build the ffmpeg argument list for one input → one output.
 * Thumbnails is handled separately (multi-output).
 */
export function buildArgs(input: string, output: string, s: VideoSettings): string[] {
  const args: string[] = ["-i", input];
  if (s.operation === "trim") {
    if (!Number.isFinite(s.trimStart) || !Number.isFinite(s.trimEnd) || s.trimStart < 0 || s.trimEnd <= s.trimStart) {
      throw new Error("Trim end must be greater than the non-negative start time.");
    }
    args.push("-ss", String(s.trimStart), "-t", String(s.trimEnd - s.trimStart));
  }

  if (s.operation === "audio") {
    args.push("-vn", "-acodec", ...AUDIO_CODEC_BY_FORMAT[s.audioFormat], output);
    return args;
  }

  if (s.operation === "gif") {
    const vf = `fps=${s.gifFps},scale=${s.gifWidth}:-1:flags=lanczos`;
    args.push("-vf", vf, "-loop", "0", output);
    return args;
  }

  const filters: string[] = [];
  if (s.scaleWidth > 0) filters.push(`scale=${s.scaleWidth}:-2`);

  args.push(...videoCodecArgs(s), ...audioArgs(s));
  if (filters.length) args.push("-vf", filters.join(","));
  if (s.target === "mp4") args.push("-movflags", "+faststart");
  args.push(output);
  return args;
}

/** Evenly spaced JPEG thumbnails via fps sampling + tile-independent selection. */
export function buildThumbnailArgs(
  input: string,
  pattern: string,
  durationSec: number,
  count: number
): string[] {
  const safeCount = Math.max(1, Math.min(8, count));
  const fps = durationSec > 0 ? safeCount / durationSec : 1;
  // -vsync 0 keeps every selected frame; -frames:v caps the total
  return ["-i", input, "-vf", `fps=${fps.toFixed(4)}`, "-frames:v", String(safeCount), "-q:v", "3", pattern];
}

/** Strip container + stream metadata without re-encoding (stream copy). */
export function buildStripArgs(input: string, output: string, sameExt: string): string[] {
  const ext = sameExt.toLowerCase();
  const out = output.endsWith(`.${ext}`) ? output : `${output}.${ext}`;
  return ["-i", input, "-map", "0", "-map_metadata", "-1", "-c", "copy", out];
}

/** Infer a safe output extension from settings + operation. */
export function outputExtension(s: VideoSettings): string {
  switch (s.operation) {
    case "gif":
      return "gif";
    case "audio":
      return s.audioFormat;
    case "thumbnails":
      return "jpg";
    default:
      return s.target;
  }
}

/** Container/extension sanity for inputs we accept. */
export const VIDEO_INPUT_EXT = ["mp4", "m4v", "webm", "mov", "avi", "mkv", "ogv", "3gp"] as const;
