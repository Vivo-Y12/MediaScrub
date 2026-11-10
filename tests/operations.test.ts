import { describe, expect, it } from "vitest";
import { buildArgs, buildThumbnailArgs, outputExtension, DEFAULT_VIDEO_SETTINGS } from "@/lib/video/operations";

const base = { ...DEFAULT_VIDEO_SETTINGS };

describe("video ffmpeg arg builders", () => {
  it("compress → mp4 defaults to h264 with faststart", () => {
    const s = { ...base, operation: "compress" as const, target: "mp4" as const, crf: 30 };
    const args = buildArgs("in.mov", "out.mp4", s).join(" ");
    expect(args).toContain("-i in.mov");
    expect(args).toContain("-c:v libx264");
    expect(args).toContain("-crf 30");
    expect(args).toContain("-movflags +faststart");
    expect(args.trim().endsWith("out.mp4")).toBe(true);
  });

  it("strips audio when includeAudio is false", () => {
    const s = { ...base, includeAudio: false };
    expect(buildArgs("in.mp4", "out.mp4", s)).toContain("-an");
  });

  it("webm uses vp9 crf pipeline", () => {
    const s = { ...base, target: "webm" as const, webmCodec: "libvpx-vp9" as const };
    const args = buildArgs("in.mp4", "out.webm", s).join(" ");
    expect(args).toContain("-c:v libvpx-vp9");
    expect(args).toContain("-b:v 0");
  });

  it("scale adds width filter only when set", () => {
    expect(buildArgs("i.mp4", "o.mp4", { ...base, operation: "scale" as const, scaleWidth: 1280 }).join(" ")).toContain(
      "-vf scale=1280:-2"
    );
    expect(buildArgs("i.mp4", "o.mp4", { ...base, operation: "scale" as const, scaleWidth: 0 }).join(" ")).not.toContain(
      "-vf"
    );
  });

  it("gif builds fps+scale filter with loop", () => {
    const args = buildArgs("i.mp4", "o.gif", { ...base, operation: "gif" as const, gifFps: 12, gifWidth: 480 });
    const s = args.join(" ");
    expect(s).toContain("fps=12");
    expect(s).toContain("scale=480:-1");
    expect(s).toContain("-loop 0");
  });

  it("audio extraction drops video and picks codec", () => {
    const args = buildArgs("i.mp4", "o.mp3", { ...base, operation: "audio" as const, audioFormat: "mp3" as const });
    expect(args).toContain("-vn");
    expect(args).toContain("libmp3lame");
  });

  it("output extensions follow the operation", () => {
    expect(outputExtension({ ...base, operation: "gif" })).toBe("gif");
    expect(outputExtension({ ...base, operation: "audio", audioFormat: "wav" })).toBe("wav");
    expect(outputExtension({ ...base, operation: "convert", target: "webm" })).toBe("webm");
  });

  it("thumbnail builder clamps count to 1..8", () => {
    expect(buildThumbnailArgs("in.mp4", "t-%02d.jpg", 60, 99).join(" ")).toContain("-frames:v 8");
    expect(buildThumbnailArgs("in.mp4", "t-%02d.jpg", 60, 0).join(" ")).toContain("-frames:v 1");
  });
});
