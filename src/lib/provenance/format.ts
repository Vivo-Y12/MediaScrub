/** Identify common media containers from bytes rather than a user-controlled name or MIME type. */
export async function sniffProvenanceFormat(file: Blob): Promise<string | null> {
  const bytes = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  const has = (offset: number, signature: number[]) => signature.every((value, i) => bytes[offset + i] === value);
  const text = (offset: number, length: number) =>
    String.fromCharCode(...bytes.subarray(offset, offset + length));

  if (has(0, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (has(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (bytes.length >= 12 && text(0, 4) === "RIFF" && text(8, 4) === "WEBP") return "image/webp";
  if (bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(text(0, 6))) return "image/gif";
  if (has(0, [0x49, 0x49, 0x2a, 0x00]) || has(0, [0x4d, 0x4d, 0x00, 0x2a])) return "image/tiff";

  if (bytes.length >= 16 && text(4, 4) === "ftyp") {
    const brand = text(8, 4);
    if (["avif", "avis"].includes(brand)) return "image/avif";
    if (["heic", "heix", "mif1", "msf1"].includes(brand)) return null;
    if (brand === "qt  ") return "video/quicktime";
    return "video/mp4";
  }
  if (has(0, [0x1a, 0x45, 0xdf, 0xa3])) {
    // Only an EBML document with an actual WebM DocType is eligible for the
    // WebM exception in the destructive-processing guard.
    const header = bytes.subarray(0, Math.min(bytes.length, 512));
    const docType = (name: string) => {
      const tag = [0x42, 0x82, 0x80 + name.length, ...Array.from(name).map(c => c.charCodeAt(0))];
      return header.some((_, offset) => tag.every((value, i) => header[offset + i] === value));
    };
    if (docType("webm")) return "video/webm";
    if (docType("matroska")) return "video/x-matroska";
    return null;
  }
  if (bytes.length >= 12 && text(0, 4) === "RIFF" && text(8, 4) === "AVI ") return "video/x-msvideo";
  return null;
}
