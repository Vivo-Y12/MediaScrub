import { test, expect } from "@playwright/test";
import path from "node:path";

const fixture = (name: string) => path.join(__dirname, "fixtures", name);

test("navigation and privacy-first page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Provenance", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Provenance", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Inspect the record. Don't rewrite it." })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "Toggle menu" })).toBeVisible();
});

test("real C2PA fixture and unsigned image, with no media upload", async ({ page }) => {
  const sent: string[] = [];
  page.on("request", request => { if (request.method() !== "GET" && request.method() !== "HEAD") sent.push(`${request.method()} ${request.url()}`); });
  await page.goto("/provenance");
  await page.locator('input[type="file"][data-ready="true"]').setInputFiles([fixture("sample.png"), fixture("c2pa-sample.jpg")]);
  await page.getByRole("button", { name: "Inspect queued" }).click();
  await expect(page.getByText("No C2PA manifest detected", { exact: true }).first()).toBeVisible({ timeout: 45000 });
  await page.getByRole("button", { name: /c2pa-sample.jpg/ }).first().click();
  await expect(page.getByText("Content Credentials", { exact: true })).toBeVisible({ timeout: 45000 });
  await expect(page.getByText("SynthID: verification unavailable.", { exact: false })).toBeVisible();
  await expect(page.getByText("Manifest count")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  expect((await download).suggestedFilename()).toContain("provenance.json");
  expect(sent).toEqual([]);
});

test("image crop, rotate, conversion and download", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", request => { if (request.method() === "POST") requests.push(request.url()); });
  await page.goto("/image");
  await page.locator('input[type="file"][data-ready="true"]').setInputFiles(fixture("sample.png"));
  await page.getByLabel("Clockwise rotation").selectOption("90");
  await page.getByLabel("width %").fill("50");
  await page.getByLabel("height %").fill("50");
  await page.getByRole("button", { name: /Process 1 file/ }).click();
  await expect(page.getByText("160×120 → 60×80")).toBeVisible({ timeout: 45000 });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download sample/ }).click();
  expect((await download).suggestedFilename()).toMatch(/sample\.(webp|png)$/);
  expect(requests).toEqual([]);
});

test("metadata inspector reads ordinary image and exports report", async ({ page }) => {
  await page.goto("/metadata");
  await page.locator('input[type="file"][data-ready="true"]').setInputFiles(fixture("sample.jpg"));
  await expect(page.getByRole("button", { name: /Export report/ })).toBeVisible({ timeout: 20000 });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export report/ }).click();
  expect((await download).suggestedFilename()).toContain("report.json");
});

test("signed media cannot be stripped via metadata tool", async ({ page }) => {
  await page.goto("/metadata");
  await page.locator('input[type="file"][data-ready="true"]').setInputFiles(fixture("c2pa-sample.jpg"));
  await page.getByRole("button", { name: /Re-encode \/ remux/ }).click();
  await expect(page.getByText(/Processing paused to protect provenance/)).toBeVisible({ timeout: 45000 });
});

test("video trims a real WebM clip locally and downloads output", async ({ page }) => {
  const posts: string[] = [];
  page.on("request", r => { if (r.method() === "POST") posts.push(r.url()); });
  await page.goto("/video");
  await page.locator('input[type="file"][data-ready="true"]').setInputFiles(fixture("sample.webm"));
  await page.getByRole("button", { name: /Trim clip/ }).click();
  await page.getByRole("button", { name: "webm", exact: true }).click();
  await page.getByRole("button", { name: "VP8 (fast)" }).click();
  await page.getByRole("switch").click();
  await page.getByLabel("End").fill("0.7");
  await page.getByRole("button", { name: /Run on 1 file/ }).click();
  await expect(page.getByRole("button", { name: "Download output of sample.webm" })).toBeVisible({ timeout: 85000 });
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download output of sample.webm" }).click();
  expect((await dl).suggestedFilename()).toContain("sample.webm");
  expect(posts).toEqual([]);
});

test("selective JPEG EXIF editor removes GPS and serial, keeps pixel data", async ({ page }) => {
  await page.goto("/metadata");
  await page.locator('input[type="file"][data-ready="true"]').setInputFiles(fixture("private.jpg"));
  await expect(page.getByText("This file reveals a precise location")).toBeVisible();
  await page.getByLabel("Remove EXIF serial/owner").check();
  await page.getByLabel("Set artist (optional)").fill("MediaScrub QA");
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Apply JPEG privacy edits & download" }).click();
  const download = await dl;
  expect(download.suggestedFilename()).toBe("privacy-private.jpg");
  const exifr = await import("exifr");
  const fs = await import("node:fs/promises");
  const output = await fs.readFile(await download.path());
  const data = await exifr.default.parse(output, { gps: true, exif: true, ifd0: {} });
  expect(data?.latitude).toBeUndefined();
  expect(data?.BodySerialNumber).toBeUndefined();
  expect(data?.Artist).toBe("MediaScrub QA");
});

test("batch image ZIP and output preview work with multiple source images", async ({ page }) => {
  await page.goto("/image");
  await page.locator('input[type="file"][data-ready="true"]').setInputFiles([fixture("sample.png"), fixture("sample.jpg")]);
  await page.getByRole("button", { name: /Process 2 files/ }).click();
  await expect(page.getByText("2/2 done")).toBeVisible({ timeout: 45000 });
  await page.getByRole("button", { name: "Compare before and after" }).first().click();
  await expect(page.getByRole("button", { name: "Close comparison" })).toBeVisible();
  await page.getByRole("button", { name: "Close comparison" }).click();
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download all (.zip)" }).click();
  const zip = await dl;
  expect(zip.suggestedFilename()).toMatch(/\.zip$/);
  const fs = await import("node:fs/promises");
  const JSZip = (await import("jszip")).default;
  const archive = await JSZip.loadAsync(await fs.readFile(await zip.path()));
  expect(Object.keys(archive.files).filter(name => name.endsWith(".webp"))).toHaveLength(2);
});

test("signed C2PA image is protected from destructive re-encode", async ({ page }) => {
  await page.goto("/image");
  await page.locator('input[type="file"][data-ready="true"]').setInputFiles(fixture("c2pa-sample.jpg"));
  await page.getByRole("button", { name: /Process 1 file/ }).click();
  await expect(page.getByText(/Processing paused to protect provenance/)).toBeVisible({ timeout: 45000 });
});

test("video frame extraction produces actual JPEGs", async ({ page }) => {
  await page.goto("/video");
  await page.locator('input[type="file"][data-ready="true"]').setInputFiles(fixture("sample.webm"));
  await page.getByRole("button", { name: /Thumbnails Evenly/ }).click();
  await page.getByRole("button", { name: /Run on 1 file/ }).click();
  await expect(page.getByRole("button", { name: "Download output of sample.webm" })).toBeVisible({ timeout: 55000 });
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download output of sample.webm" }).click();
  const downloaded = await dl;
  const fs = await import("node:fs/promises");
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await fs.readFile(await downloaded.path()));
  expect(Object.keys(zip.files).filter(n => n.endsWith(".jpg")).length).toBeGreaterThan(0);
});

test("no cross-origin request occurs during C2PA inspection", async ({ page }) => {
  const external: string[] = [];
  page.on("request", r => { if (new URL(r.url()).origin !== "http://localhost:3000" && !r.url().startsWith("blob:")) external.push(r.url()); });
  await page.goto("/provenance");
  await page.locator('input[type="file"][data-ready="true"]').setInputFiles(fixture("c2pa-sample.jpg"));
  await page.getByRole("button", { name: "Inspect queued" }).click();
  await expect(page.getByText("Signature valid · trust not checked").first()).toBeVisible({ timeout: 45000 });
  expect(external).toEqual([]);
});

test("video WebM input converts to playable MP4", async ({ page }) => {
  await page.goto("/video");
  await page.locator('input[type="file"][data-ready="true"]').setInputFiles(fixture("sample.webm"));
  await page.getByRole("button", { name: /Convert Re-mux/ }).click();
  await page.getByRole("switch").click();
  await page.getByRole("button", { name: /Run on 1 file/ }).click();
  await expect(page.getByRole("button", { name: "Download output of sample.webm" })).toBeVisible({ timeout: 55000 });
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download output of sample.webm" }).click();
  const result = await dl;
  expect(result.suggestedFilename()).toBe("sample.mp4");
  const fs = await import("node:fs/promises");
  const bytes = await fs.readFile(await result.path());
  expect(bytes.subarray(4, 8).toString("ascii")).toBe("ftyp");
});

test("video animated GIF output has a real GIF header", async ({ page }) => {
  await page.goto("/video");
  await page.locator('input[type="file"][data-ready="true"]').setInputFiles(fixture("sample.webm"));
  await page.getByRole("button", { name: /Make GIF/ }).click();
  await page.getByRole("button", { name: /Run on 1 file/ }).click();
  await expect(page.getByRole("button", { name: "Download output of sample.webm" })).toBeVisible({ timeout: 55000 });
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download output of sample.webm" }).click();
  const result = await dl;
  expect(result.suggestedFilename()).toBe("sample.gif");
  const fs = await import("node:fs/promises");
  const bytes = await fs.readFile(await result.path());
  expect(bytes.subarray(0, 3).toString()).toBe("GIF");
});

test("video extracts audio to WAV from a real audio-bearing WebM", async ({ page }) => {
  await page.goto("/video");
  await page.locator('input[type="file"][data-ready="true"]').setInputFiles(fixture("sample-audio.webm"));
  await page.getByRole("button", { name: /Extract audio/ }).click();
  await page.getByRole("button", { name: "wav", exact: true }).click();
  await page.getByRole("button", { name: /Run on 1 file/ }).click();
  await expect(page.getByRole("button", { name: "Download output of sample-audio.webm" })).toBeVisible({ timeout: 55000 });
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download output of sample-audio.webm" }).click();
  const result = await dl;
  expect(result.suggestedFilename()).toBe("sample-audio.wav");
  const fs = await import("node:fs/promises");
  const bytes = await fs.readFile(await result.path());
  expect(bytes.subarray(0, 4).toString()).toBe("RIFF");
});

test("video compresses a VP8 WebM locally", async ({ page }) => {
  await page.goto("/video");
  await page.locator('input[type="file"][data-ready="true"]').setInputFiles(fixture("sample.webm"));
  await page.getByRole("button", { name: "webm", exact: true }).click();
  await page.getByRole("button", { name: "VP8 (fast)" }).click();
  await page.getByRole("switch").click();
  await page.getByRole("button", { name: /Run on 1 file/ }).click();
  await expect(page.getByRole("button", { name: "Download output of sample.webm" })).toBeVisible({ timeout: 55000 });
});

test("video scaling produces real resized output", async ({ page }) => {
  await page.goto("/video");
  await page.locator('input[type="file"][data-ready="true"]').setInputFiles(fixture("sample.webm"));
  await page.getByRole("button", { name: /Resize Change resolution/ }).click();
  await page.getByRole("button", { name: "webm", exact: true }).click();
  await page.getByRole("button", { name: "VP8 (fast)" }).click();
  await page.getByRole("button", { name: "640", exact: true }).click();
  await page.getByRole("switch").click();
  await page.getByRole("button", { name: /Run on 1 file/ }).click();
  await expect(page.getByRole("button", { name: "Download output of sample.webm" })).toBeVisible({ timeout: 55000 });
  await expect.poll(async () => page.locator("video").last().evaluate((v: HTMLVideoElement) => v.videoWidth)).toBe(640);
});

test("video cancellation returns the queued file without a fake result", async ({ page }) => {
  await page.goto("/video");
  await page.locator('input[type="file"][data-ready="true"]').setInputFiles(fixture("sample.webm"));
  await page.getByRole("button", { name: /Resize Change resolution/ }).click();
  await page.getByRole("button", { name: "1920", exact: true }).click();
  await page.getByRole("button", { name: /Run on 1 file/ }).click();
  await page.getByRole("button", { name: "Cancel & kill engine" }).click();
  await expect(page.getByRole("button", { name: /Run on 1 file/ })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("button", { name: "Download output of sample.webm" })).toHaveCount(0);
});

test("real signed MP4 video shows verified C2PA history and is not modified", async ({ page }) => {
  const posts: string[] = [];
  page.on("request", r => { if (r.method() === "POST") posts.push(r.url()); });
  await page.goto("/provenance");
  await page.locator('input[type="file"][data-ready="true"]').setInputFiles(fixture("c2pa-video.mp4"));
  await page.getByRole("button", { name: "Inspect queued" }).click();
  await expect(page.getByText("Signature valid · trust not checked").first()).toBeVisible({ timeout: 45000 });
  await expect(page.getByText("Provenance history · 2 manifest(s)")).toBeVisible();
  expect(posts).toEqual([]);
});

test("signed MP4 video is blocked before FFmpeg conversion", async ({ page }) => {
  await page.goto("/video");
  await page.locator('input[type="file"][data-ready="true"]').setInputFiles(fixture("c2pa-video.mp4"));
  await page.getByRole("button", { name: /Run on 1 file/ }).click();
  await expect(page.getByText(/Processing paused to protect provenance/)).toBeVisible({ timeout: 45000 });
  await expect(page.getByRole("button", { name: "Download output of c2pa-video.mp4" })).toHaveCount(0);
});

test("mobile navigation and theme toggle persist across page changes", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("light");
  await page.getByRole("button", { name: "Toggle menu" }).click();
  await page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: "Metadata" }).click();
  await expect(page.getByRole("heading", { name: "Read what's written inside your files." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("light");
});

test("out-of-duration video trim stops with a clear per-file error", async ({ page }) => {
  await page.goto("/video");
  await page.locator('input[type="file"][data-ready="true"]').setInputFiles(fixture("sample.mp4"));
  await expect(page.getByText("sample.mp4", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Trim clip/ }).click();
  await page.getByLabel("End").fill("20");
  await page.getByRole("button", { name: /Run on 1 file/ }).click();
  await expect(page.getByText(/Trim end 20s exceeds this video's/)).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("button", { name: "Download output of sample.mp4" })).toHaveCount(0);
});

test("renaming signed JPEG to WebM cannot bypass Image Studio provenance guard", async ({ page }) => {
  const { readFile } = await import("node:fs/promises");
  await page.goto("/image");
  await page.locator('input[type="file"][data-ready="true"]').setInputFiles({
    name: "signed.webm", mimeType: "image/jpeg", buffer: await readFile(fixture("c2pa-sample.jpg")),
  });
  await page.getByRole("button", { name: /Process 1 file/ }).click();
  await expect(page.getByText(/Processing paused to protect provenance/)).toBeVisible({ timeout: 45000 });
  await expect(page.getByRole("button", { name: /Download signed/ })).toHaveCount(0);
});

test("renaming signed MP4 to WebM preserves verification and blocks transcoding", async ({ page }) => {
  const { readFile } = await import("node:fs/promises");
  const disguised = { name: "signed.webm", mimeType: "video/webm", buffer: await readFile(fixture("c2pa-video.mp4")) };
  await page.goto("/provenance");
  await page.locator('input[type="file"][data-ready="true"]').setInputFiles(disguised);
  await page.getByRole("button", { name: "Inspect queued" }).click();
  await expect(page.getByText("Signature valid · trust not checked").first()).toBeVisible({ timeout: 45000 });
  await page.goto("/video");
  await page.locator('input[type="file"][data-ready="true"]').setInputFiles(disguised);
  await page.getByRole("button", { name: /Run on 1 file/ }).click();
  await expect(page.getByText(/Processing paused to protect provenance/)).toBeVisible({ timeout: 45000 });
  await expect(page.getByRole("button", { name: "Download output of signed.webm" })).toHaveCount(0);
});

test("unsigned WebM metadata remux downloads a valid local file", async ({ page }) => {
  const posts: string[] = [];
  page.on("request", request => { if (request.method() === "POST") posts.push(request.url()); });
  await page.goto("/metadata");
  await page.locator('input[type="file"][data-ready="true"]').setInputFiles(fixture("sample.webm"));
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Re-encode \/ remux/ }).click();
  const result = await download;
  expect(result.suggestedFilename()).toBe("clean-sample.webm");
  const { readFile } = await import("node:fs/promises");
  const bytes = await readFile(await result.path());
  expect(bytes.subarray(0, 4).toString("hex")).toBe("1a45dfa3");
  expect(posts).toEqual([]);
});

test("image Stop followed by retry cannot publish a stale result", async ({ page }) => {
  await page.goto("/image");
  await page.locator('input[type="file"][data-ready="true"]').setInputFiles([fixture("c2pa-sample.jpg"), fixture("sample.png")]);
  await page.getByRole("button", { name: /Process 2 files/ }).click();
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByRole("button", { name: /Process 2 files/ })).toBeVisible();
  await page.getByRole("button", { name: /Process 2 files/ }).click();
  await expect(page.getByText(/Processing paused to protect provenance/)).toBeVisible({ timeout: 45000 });
  await expect(page.getByRole("button", { name: "Download sample.png" })).toBeVisible({ timeout: 45000 });
  await expect(page.getByText("1/2 done")).toBeVisible();
  await expect(page.getByRole("button", { name: "Download c2pa-sample.jpg" })).toHaveCount(0);
});

test("video Cancel followed by retry finishes one fresh conversion", async ({ page }) => {
  await page.goto("/video");
  await page.locator('input[type="file"][data-ready="true"]').setInputFiles(fixture("sample.webm"));
  await page.getByRole("button", { name: /Resize Change resolution/ }).click();
  await page.getByRole("button", { name: "1920", exact: true }).click();
  await page.getByRole("button", { name: /Run on 1 file/ }).click();
  await page.getByRole("button", { name: "Cancel & kill engine" }).click();
  await page.getByRole("button", { name: "640", exact: true }).click();
  await page.getByRole("button", { name: "webm", exact: true }).click();
  await page.getByRole("button", { name: "VP8 (fast)" }).click();
  await page.getByRole("switch").click();
  await page.getByRole("button", { name: /Run on 1 file/ }).click();
  await expect(page.getByRole("button", { name: "Download output of sample.webm" })).toBeVisible({ timeout: 60000 });
  await expect(page.getByText("1/1 done")).toBeVisible();
});

test("video ZIP preserves both files when batch inputs share a name", async ({ page }) => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(fixture("sample.webm"));
  const repeated = { name: "repeated.webm", mimeType: "video/webm", buffer: source };
  await page.goto("/video");
  await page.locator('input[type="file"][data-ready="true"]').setInputFiles([repeated, repeated]);
  await page.getByRole("button", { name: /Run on 2 files/ }).click();
  await expect(page.getByText("2/2 done")).toBeVisible({ timeout: 100000 });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download all (.zip)" }).click();
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await readFile(await (await download).path()));
  const names = Object.keys(zip.files).filter(name => name.endsWith(".mp4"));
  expect(names.sort()).toEqual(["repeated-1.mp4", "repeated.mp4"]);
  for (const name of names) expect((await zip.file(name)!.async("uint8array")).length).toBeGreaterThan(100);
});

test("local C2PA scan has no external detector handoff or media upload", async ({ page }) => {
  const offsite: string[] = [];
  const posts: string[] = [];
  page.on("request", request => {
    if (new URL(request.url()).origin !== "http://localhost:3000") offsite.push(request.url());
    if (request.method() === "POST") posts.push(request.url());
  });
  await page.goto("/provenance");
  await expect(page.getByRole("heading", { name: "C2PA provenance inspection" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Metadata & Privacy" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open Metadata & Privacy/ })).toHaveAttribute("href", "/metadata");
  await expect(page.locator('a[href*="synthid.com"]')).toHaveCount(0);
  await expect(page.getByText("01 · watermark check · external")).toHaveCount(0);
  await page.locator('input[type="file"][data-ready="true"]').setInputFiles(fixture("sample.png"));
  await page.getByRole("button", { name: "Inspect queued" }).click();
  await expect(page.getByText("No C2PA manifest detected", { exact: true }).first()).toBeVisible({ timeout: 45000 });
  await expect(page.getByText("SynthID: verification unavailable.", { exact: false })).toBeVisible();
  expect(offsite).toEqual([]);
  expect(posts).toEqual([]);
});
