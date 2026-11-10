import piexif from "piexifjs";
import { assertNoSignedProvenance } from "@/lib/provenance/inspect";

export interface JpegPrivacyEdits {
  removeGps: boolean;
  removeSerial: boolean;
  artist: string;
  description: string;
}

/** Rebuild the EXIF APP1 segment without recompressing pixels; all other JPEG segments stay intact. */
export async function editJpegMetadata(file: File, edits: JpegPrivacyEdits): Promise<Blob> {
  if (!/\.jpe?g$/i.test(file.name) || (file.type && file.type !== "image/jpeg")) throw new Error("Selective EXIF edits require a JPEG file.");
  if (file.size > 20 * 1024 * 1024) throw new Error("Selective JPEG editor is limited to 20 MB to avoid browser memory exhaustion.");
  await assertNoSignedProvenance(file);
  const source = new Uint8Array(await file.arrayBuffer());
  if (source[0] !== 0xff || source[1] !== 0xd8) throw new Error("Not a valid JPEG header.");
  const parts: string[] = [];
  for (let i = 0; i < source.length; i += 16384) parts.push(String.fromCharCode(...source.subarray(i, i + 16384)));
  const jpeg = parts.join("");
  const exif = piexif.load(jpeg);
  exif.Exif ??= {}; exif["0th"] ??= {}; exif.GPS ??= {};
  if (edits.removeGps) exif.GPS = {};
  if (edits.removeSerial) {
    for (const tag of [piexif.ExifIFD.BodySerialNumber, piexif.ExifIFD.LensSerialNumber, piexif.ExifIFD.CameraOwnerName]) delete exif.Exif[tag];
  }
  // EXIF ASCII tags; do not silently mangle Unicode.
  for (const value of [edits.artist, edits.description]) {
    if (value.length > 200 || /[^\x20-\x7e]/.test(value)) throw new Error("Edited EXIF text must be printable ASCII, at most 200 characters.");
  }
  if (edits.artist) exif["0th"][piexif.ImageIFD.Artist] = edits.artist;
  if (edits.description) exif["0th"][piexif.ImageIFD.ImageDescription] = edits.description;
  const encoded = piexif.insert(piexif.dump(exif), jpeg);
  const bytes = new Uint8Array(encoded.length);
  for (let i = 0; i < encoded.length; i++) bytes[i] = encoded.charCodeAt(i);
  return new Blob([bytes], { type: "image/jpeg" });
}
