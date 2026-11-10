import { describe, expect, it } from "vitest";
import { formatBytes, formatDuration, uniqueName, withExtension, clamp, savingsPct, isImageFile } from "@/lib/utils";

describe("formatBytes", () => {
  it("handles zero, kb, mb, gb", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.00 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.00 MB");
    expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe("2.00 GB");
  });
  it("handles junk input", () => {
    expect(formatBytes(undefined)).toBe("—");
    expect(formatBytes(-5)).toBe("—");
  });
});

describe("formatDuration", () => {
  it("formats h/m/s", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(3725)).toBe("1:02:05");
    expect(formatDuration(null)).toBe("—");
  });
});

describe("filename helpers", () => {
  it("withExtension swaps ext", () => {
    expect(withExtension("photo.png", "webp")).toBe("photo.webp");
    expect(withExtension("archive.tar.gz", "zip")).toBe("archive.tar.zip");
    expect(withExtension("noext", "jpg")).toBe("noext.jpg");
  });
  it("uniqueName dedupes", () => {
    const taken = new Set(["a.png"]);
    expect(uniqueName("a.png", taken)).toBe("a-1.png");
    taken.add("a-1.png");
    expect(uniqueName("a.png", taken)).toBe("a-2.png");
    expect(uniqueName("b.png", taken)).toBe("b.png");
  });
});

describe("misc", () => {
  it("clamp", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
  it("savingsPct", () => {
    expect(savingsPct(1000, 500)).toBe("−50%");
    expect(savingsPct(1000, 1500)).toBe("+50%");
    expect(savingsPct(0, 5)).toBeNull();
  });
  it("isImageFile by mime and extension", () => {
    expect(isImageFile(new File([""], "x.png", { type: "" }))).toBe(true);
    expect(isImageFile(new File([""], "x", { type: "image/webp" }))).toBe(true);
    expect(isImageFile(new File([""], "x.mp4", { type: "video/mp4" }))).toBe(false);
  });
});
