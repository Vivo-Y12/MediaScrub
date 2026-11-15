import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const fixture = (name: string) => path.join(__dirname, "fixtures", name);

interface DownloadedImage {
  bytes: string;
  name: string;
}

async function imageResult(page: import("@playwright/test").Page, passes: 0 | 1 | 2): Promise<DownloadedImage> {
  await page.goto("/image");
  await page.getByRole("radio", { name: /PNG/ }).check();
  await page.locator('input[type="file"][data-ready="true"]').setInputFiles(fixture("sample.png"));
  if (passes > 0) {
    await page.getByRole("checkbox", { name: "Reprocess image pixels locally (opt-in)" }).check();
    await page.getByLabel("Resample and re-encode passes").selectOption(String(passes));
  }
  await page.getByRole("button", { name: "Process 1 file" }).click();
  await expect(page.getByRole("button", { name: /Download sample/ })).toBeVisible({ timeout: 45000 });
  if (passes > 0) {
    await page.getByRole("button", { name: /notes?/ }).click();
    await expect(page.getByText(new RegExp(`applied ${passes} resampling pass\\(es\\)`))).toBeVisible();
    await expect(page.getByText(/does not detect SynthID or prove a watermark was removed/)).toBeVisible();
  }
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download sample/ }).click();
  const download = await pending;
  return { bytes: (await readFile(await download.path())).toString("base64"), name: download.suggestedFilename() };
}

test("both opt-in strengths create distinct downloadable pixels without a SynthID verdict or upload", async ({ page }) => {
  const sent: string[] = [];
  page.on("request", request => { if (request.method() === "POST") sent.push(request.url()); });
  const source = await readFile(fixture("sample.png"));
  const normal = await imageResult(page, 0);
  const one = await imageResult(page, 1);
  const two = await imageResult(page, 2);
  expect(normal.name).toBe("sample.png");
  expect(one.name).toBe("sample-reprocessed.png");
  expect(two.name).toBe("sample-reprocessed-2pass.png");

  // Later setting changes must not rename or alter an already processed result.
  await page.getByLabel("Resample and re-encode passes").selectOption("1");
  const zipPending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download all (.zip)" }).click();
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await readFile(await (await zipPending).path()));
  expect(zip.file(two.name)).not.toBeNull();

  const pixelsDiffer = await page.evaluate(async (images) => {
    async function pixels(base64: string) {
      const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width; canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    }
    const [a, b, c] = await Promise.all(images.map(pixels));
    const differs = (x: Uint8ClampedArray, y: Uint8ClampedArray) => x.length === y.length && x.some((value, i) => value !== y[i]);
    return { one: differs(a, b), two: differs(b, c) };
  }, [normal.bytes, one.bytes, two.bytes]);

  expect(pixelsDiffer).toEqual({ one: true, two: true });
  expect(await readFile(fixture("sample.png"))).toEqual(source);
  expect(sent).toEqual([]);
});

test("two-pass option does not bypass protection on signed C2PA files", async ({ page }) => {
  await page.goto("/image");
  await page.getByRole("checkbox", { name: "Reprocess image pixels locally (opt-in)" }).check();
  await page.getByLabel("Resample and re-encode passes").selectOption("2");
  await page.locator('input[type="file"][data-ready="true"]').setInputFiles(fixture("c2pa-sample.jpg"));
  await page.getByRole("button", { name: "Process 1 file" }).click();
  await expect(page.getByText(/Processing paused to protect provenance/)).toBeVisible({ timeout: 45000 });
  await expect(page.getByRole("button", { name: /Download c2pa-sample/ })).toHaveCount(0);
});
