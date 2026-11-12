/*
 * Optional browser-local pixel reprocessing inspired by published robustness
 * experiments, not a SynthID decoder or a verified removal method.
 * No external models, data transfer, codebooks or third-party code.
 */
export function intermediateSize(width: number, height: number) {
  return {
    width: Math.max(1, Math.min(width - 1, Math.round(width * 0.97))),
    height: Math.max(1, Math.min(height - 1, Math.round(height * 0.96))),
  };
}

export async function reprocessPixels(canvas: OffscreenCanvas, preserveAlpha: boolean): Promise<string[]> {
  const warnings: string[] = [
    "Experimental pixel reprocessing was applied. This does not detect SynthID or prove a watermark was removed.",
  ];
  const { width, height } = canvas;
  if (width < 2 || height < 2) {
    warnings.push("Image is too small for geometric resampling; pixels were not changed by this option.");
    return warnings;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Pixel reprocessing needs a 2D canvas.");
  const size = intermediateSize(width, height);
  const middle = new OffscreenCanvas(size.width, size.height);
  const midCtx = middle.getContext("2d");
  if (!midCtx) throw new Error("Pixel reprocessing needs an intermediate canvas.");
  midCtx.imageSmoothingEnabled = true;
  midCtx.imageSmoothingQuality = "high";
  midCtx.drawImage(canvas, 0, 0, size.width, size.height);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(middle, 0, 0, width, height);

  // An internal lossy pass changes pixels even if the final output is PNG.
  // For alpha-bearing outputs, WebP is used only if this browser actually encodes it.
  const mime = preserveAlpha ? "image/webp" : "image/jpeg";
  const intermediate = await canvas.convertToBlob({ type: mime, quality: 0.82 });
  if (intermediate.type !== mime) {
    warnings.push("This browser cannot make an alpha-safe lossy intermediate; only resampling was applied.");
    return warnings;
  }
  const bitmap = await createImageBitmap(intermediate);
  try {
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0);
  } finally {
    bitmap.close();
  }
  return warnings;
}
