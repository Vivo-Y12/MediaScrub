import { afterEach, describe, expect, it, vi } from "vitest";
import { ImageProcessor } from "@/lib/image/processor";
import { DEFAULT_IMAGE_SETTINGS } from "@/lib/image/types";

class StubWorker {
  onmessage?: (e: MessageEvent) => void;
  onerror?: (e: ErrorEvent) => void;
  static instances: StubWorker[] = [];
  terminated = false;
  sent: unknown[] = [];
  constructor() { StubWorker.instances.push(this); }
  postMessage(value: unknown) { this.sent.push(value); }
  terminate() { this.terminated = true; }
}

afterEach(() => { vi.unstubAllGlobals(); StubWorker.instances = []; });

describe("worker-pool lifecycle", () => {
  it("rejects running and queued work on hard cancellation", async () => {
    vi.stubGlobal("Worker", StubWorker);
    const pool = new ImageProcessor(1);
    const file = Object.assign(new Blob(["fixture"], { type: "image/png" }), { name: "x.png" }) as File;
    const a = pool.process(file, DEFAULT_IMAGE_SETTINGS).promise;
    const b = pool.process(file, DEFAULT_IMAGE_SETTINGS).promise;
    expect(StubWorker.instances[0].sent).toHaveLength(1);
    pool.destroy();
    await expect(a).rejects.toThrow("cancelled");
    await expect(b).rejects.toThrow("cancelled");
    expect(StubWorker.instances[0].terminated).toBe(true);
  });
  it("worker failure does not reject work assigned to healthy workers", async () => {
    vi.stubGlobal("Worker", StubWorker);
    const pool = new ImageProcessor(2);
    const file = Object.assign(new Blob(["fixture"], { type: "image/png" }), { name: "x.png" }) as File;
    const a = pool.process(file, DEFAULT_IMAGE_SETTINGS).promise;
    const b = pool.process(file, DEFAULT_IMAGE_SETTINGS).promise;
    StubWorker.instances[0].onerror?.({ message: "boom" } as ErrorEvent);
    await expect(a).rejects.toThrow("boom");
    StubWorker.instances[1].onmessage?.({ data: { type: "result", id: (StubWorker.instances[1].sent[0] as { id: string }).id, ok: true, blob: new Blob(["ok"]), outMime: "image/png", warnings: [], durationMs: 1 } } as MessageEvent);
    await expect(b).resolves.toMatchObject({ outMime: "image/png" });
    pool.destroy();
  });
});
