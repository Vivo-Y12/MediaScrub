import { describe, expect, it } from "vitest";
import { intermediateSize } from "@/lib/image/pixel-reprocess";
import { DEFAULT_IMAGE_SETTINGS } from "@/lib/image/types";

describe("experimental pixel reprocessing defaults and bounds", () => {
  it("is disabled by default, including in the normal image pipeline", () => {
    expect(DEFAULT_IMAGE_SETTINGS.experimentalPixelReprocess).toBe(false);
  });
  it("never creates a zero-sized or enlarged intermediate image", () => {
    for (const [width, height] of [[2, 2], [160, 120], [4000, 3000]]) {
      const size = intermediateSize(width, height);
      expect(size.width).toBeGreaterThanOrEqual(1);
      expect(size.height).toBeGreaterThanOrEqual(1);
      expect(size.width).toBeLessThan(width);
      expect(size.height).toBeLessThan(height);
    }
  });
});
