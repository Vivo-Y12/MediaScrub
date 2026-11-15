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

export async function reprocessPixels(canvas: OffscreenCanvas, preserveAlpha: boolean, passes: 1 | 2 = 1): Promise<string[]> {
  const { width, height } = canvas;
  const disclaimer = "This does not detect SynthID or prove a watermark was removed.";
  if (width < 2 || height < 2) {
    return [`Image is too small for pixel reprocessing; no additional pass was applied. ${disclaimer}`];
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Pixel reprocessing needs a 2D canvas.");
  const warnings: string[] = [];
  let lossyPasses = 0;

  for (let pass = 0; pass < passes; pass++) {
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
    // Use WebP for alpha only when this browser actually supports its encoder.
    const mime = preserveAlpha ? "image/webp" : "image/jpeg";
    const intermediate = await canvas.convertToBlob({ type: mime, quality: 0.82 });
    if (intermediate.type !== mime) {
      warnings.push("A compatible lossy intermediate was unavailable; this pass only resampled pixels.");
      continue;
    }
    const bitmap = await createImageBitmap(intermediate);
    try {
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0);
      lossyPasses++;
    } finally {
      bitmap.close();
    }
  }
  return [
    `Experimental pixel reprocessing applied ${passes} resampling pass(es) and ${lossyPasses} lossy pass(es). ${disclaimer}`,
    ...warnings,
  ];
}
