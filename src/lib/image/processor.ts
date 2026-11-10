/** Bounded client-side image worker pool; crashed jobs fail independently and cancellation releases memory. */
import { uid } from "@/lib/utils";
import type { ImageJobRequest, ImageSettings, WorkerOutMessage } from "./types";

export interface ImageRunResult {
  blob: Blob; outMime: string; outExt: string;
  width: number; height: number; srcWidth: number; srcHeight: number;
  warnings: string[]; durationMs: number;
}
interface Pending {
  resolve: (r: ImageRunResult) => void;
  reject: (e: Error) => void;
  onProgress?: (p: number) => void;
}

export class ImageProcessor {
  private workers: Worker[] = [];
  private active = new Map<Worker, string>();
  private pending = new Map<string, Pending>();
  private queue: ImageJobRequest[] = [];
  private destroyed = false;

  constructor(size?: number) {
    const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 4 : 4;
    const count = size ?? Math.max(1, Math.min(3, cores - 2));
    for (let i = 0; i < count; i++) this.spawn();
  }

  private spawn() {
    const worker = new Worker(new URL("./image.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => this.handleMessage(worker, e.data);
    worker.onerror = (e) => this.handleWorkerError(worker, e);
    this.workers.push(worker);
  }

  private handleMessage(worker: Worker, msg: WorkerOutMessage) {
    if (this.destroyed) return;
    if (msg.type === "progress") {
      this.pending.get(msg.id)?.onProgress?.(msg.progress);
      return;
    }
    const entry = this.pending.get(msg.id);
    this.pending.delete(msg.id);
    this.active.delete(worker);
    if (entry) {
      if (msg.ok && msg.blob && msg.outMime) {
        entry.resolve({ blob: msg.blob, outMime: msg.outMime, outExt: msg.outExt ?? "png",
          width: msg.width ?? 0, height: msg.height ?? 0, srcWidth: msg.srcWidth ?? 0,
          srcHeight: msg.srcHeight ?? 0, warnings: msg.warnings, durationMs: msg.durationMs });
      } else entry.reject(new Error(msg.error || "Processing failed"));
    }
    this.pump();
  }

  private handleWorkerError(worker: Worker, e: ErrorEvent) {
    if (this.destroyed) return;
    const id = this.active.get(worker);
    if (id) {
      this.pending.get(id)?.reject(new Error(e.message || "Image worker crashed"));
      this.pending.delete(id);
    }
    this.active.delete(worker);
    worker.terminate();
    this.workers = this.workers.filter(w => w !== worker);
    this.spawn();
    this.pump();
  }

  private pump() {
    for (const worker of this.workers) {
      if (this.active.has(worker)) continue;
      const job = this.queue.shift();
      if (!job) break;
      this.active.set(worker, job.id);
      try { worker.postMessage(job); } catch (error) {
        this.handleWorkerError(worker, { message: String(error) } as ErrorEvent);
      }
    }
  }

  process(file: File, settings: ImageSettings, onProgress?: (p: number) => void): { id: string; promise: Promise<ImageRunResult> } {
    if (this.destroyed) throw new Error("Image processor was cancelled");
    const id = uid("img");
    const promise = new Promise<ImageRunResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onProgress });
      this.queue.push({ id, file, fileName: file.name, sourceSize: file.size, settings });
      this.pump();
    });
    return { id, promise };
  }

  destroy() {
    this.destroyed = true;
    this.workers.forEach(w => w.terminate());
    this.workers = [];
    this.queue = [];
    this.active.clear();
    this.pending.forEach(p => p.reject(new Error("Image processing cancelled")));
    this.pending.clear();
  }
}
