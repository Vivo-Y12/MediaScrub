/**
 * Runtime detection of what THIS browser can actually do.
 * We never claim format support we haven't verified in-session.
 */

export type EncodeFormat = "image/png" | "image/jpeg" | "image/webp" | "image/avif";

export interface Capabilities {
  checked: boolean;
  encode: Record<EncodeFormat, boolean | "unknown">;
  decodeAvif: boolean | "unknown";
  offscreenCanvas: boolean;
  webCodecs: boolean;
  sharedArrayBuffer: boolean;
  webAssembly: boolean;
  workers: boolean;
  cores: number;
  deviceMemoryGb: number | null;
}

let cache: Capabilities | null = null;
let inflight: Promise<Capabilities> | null = null;

async function probeEncode(mime: EncodeFormat): Promise<boolean> {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(0, 0, 8, 8);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), mime, 0.92)
    );
    return !!blob && blob.type === mime;
  } catch {
    return false;
  }
}

async function probeAvifDecode(): Promise<boolean> {
  // 2x2 lossless AVIF
  const avif =
    "data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAEAAAAABAAABAQAAAEAAAAAbAAAAHGlpbmYAAAAAAAEAAAAaAWEAAAAAAWluZmUAAAAAAQAAAAlraXAwAAAAAwAAAACWaXBocgAAAARpcGNvAAAAFWlzcGUAAAAAAAAAAgAAAAIAAAAPcGl4aQAAAAAABwgIAAAACWlwcnAAAABmaXBtYQAAAFNhdmNDEgAAAEQxwYMBDxkAAoKkABRxpQAAAAAAMEgQvcnH0ACAAABhheGM=";
  try {
    const img = new Image();
    const ok = await new Promise<boolean>((resolve) => {
      img.onload = () => resolve(img.naturalWidth > 0);
      img.onerror = () => resolve(false);
      img.src = avif;
    });
    return ok;
  } catch {
    return false;
  }
}

export function getCapabilities(): Promise<Capabilities> {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  if (typeof window === "undefined") {
    return Promise.resolve({
      checked: false,
      encode: {
        "image/png": "unknown",
        "image/jpeg": "unknown",
        "image/webp": "unknown",
        "image/avif": "unknown",
      },
      decodeAvif: "unknown",
      offscreenCanvas: false,
      webCodecs: false,
      sharedArrayBuffer: false,
      webAssembly: false,
      workers: false,
      cores: 4,
      deviceMemoryGb: null,
    });
  }

  inflight = (async () => {
    const [png, jpeg, webp, avifEnc, avifDec] = await Promise.all([
      probeEncode("image/png"),
      probeEncode("image/jpeg"),
      probeEncode("image/webp"),
      probeEncode("image/avif"),
      probeAvifDecode(),
    ]);
    const nav = navigator as Navigator & { deviceMemory?: number };
    cache = {
      checked: true,
      encode: {
        "image/png": png,
        "image/jpeg": jpeg,
        "image/webp": webp,
        "image/avif": avifEnc,
      },
      decodeAvif: avifDec,
      offscreenCanvas: typeof OffscreenCanvas !== "undefined",
      webCodecs: typeof VideoEncoder !== "undefined",
      sharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
      webAssembly: typeof WebAssembly !== "undefined",
      workers: typeof Worker !== "undefined",
      cores: navigator.hardwareConcurrency ?? 4,
      deviceMemoryGb: typeof nav.deviceMemory === "number" ? nav.deviceMemory : null,
    };
    return cache;
  })();

  return inflight;
}

/** Suggest a safe max video size based on heuristics — honest guardrails, not promises. */
export function recommendedVideoLimitMb(caps: Capabilities): number {
  if (!caps.webAssembly) return 0;
  const mem = caps.deviceMemoryGb;
  if (mem == null) return 500;
  if (mem <= 4) return 250;
  if (mem <= 8) return 700;
  return 1500;
}
