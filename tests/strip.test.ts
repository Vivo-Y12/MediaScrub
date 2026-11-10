import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/video/ffmpeg", () => ({ getFFmpeg: vi.fn() }));
import { getFFmpeg } from "@/lib/video/ffmpeg";
import { stripVideoMetadata } from "@/lib/metadata/strip";

afterEach(() => vi.resetAllMocks());

function fakeEngine() {
  return {
    writeFile: vi.fn(async () => undefined),
    exec: vi.fn(async () => 0),
    readFile: vi.fn(async () => new Uint8Array([1, 2, 3])),
    deleteFile: vi.fn(async (_name: string) => undefined),
  };
}

const sample = () => new File([new Uint8Array([1, 2])], "clip.webm", { type: "video/webm" });

describe("FFmpeg virtual file cleanup", () => {
  it("deletes both input and output on success", async () => {
    const ff = fakeEngine();
    vi.mocked(getFFmpeg).mockResolvedValue(ff as unknown as Awaited<ReturnType<typeof getFFmpeg>>);
    const result = await stripVideoMetadata(sample());
    expect(result.size).toBe(3);
    expect(ff.deleteFile).toHaveBeenCalledTimes(2);
    const names = ff.deleteFile.mock.calls.map(([name]) => name);
    expect(names[0]).toMatch(/-in\.webm$/);
    expect(names[1]).toMatch(/-out\.webm$/);
  });

  it("deletes partial output when FFmpeg rejects the remux", async () => {
    const ff = fakeEngine();
    ff.exec.mockResolvedValue(1);
    vi.mocked(getFFmpeg).mockResolvedValue(ff as unknown as Awaited<ReturnType<typeof getFFmpeg>>);
    await expect(stripVideoMetadata(sample())).rejects.toThrow("Metadata strip failed");
    expect(ff.deleteFile).toHaveBeenCalledTimes(2);
  });

  it("deletes both files when reading output fails", async () => {
    const ff = fakeEngine();
    ff.readFile.mockRejectedValue(new Error("read failed"));
    vi.mocked(getFFmpeg).mockResolvedValue(ff as unknown as Awaited<ReturnType<typeof getFFmpeg>>);
    await expect(stripVideoMetadata(sample())).rejects.toThrow("read failed");
    expect(ff.deleteFile).toHaveBeenCalledTimes(2);
  });
});
