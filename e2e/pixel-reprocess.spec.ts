import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const fixture = (name: string) => path.join(__dirname, "fixtures", name);

async function imageResult(page: import("@playwright/test").Page, experimental: boolean): Promise<string> {
  await page.goto("/image");
  await page.getByRole("radio", { name: /PNG/ }).check();
  await page.locator('input[type="file"][data-ready="true"]').setInputFiles(fixture("sample.png"));
  if (experimental) await page.getByRole("checkbox", { name: "Reprocess image pixels locally (opt-in)" }).check();
  await page.getByRole("button", { name: "Process 1 file" }).click();
  await expect(page.getByRole("button", { name: /Download sample/ })).toBeVisible({ timeout: 45000 });
  if (experimental) {
    await page.getByRole("button", { name: /notes?/ }).click();
    await expect(page.getByText(/does not detect SynthID or prove a watermark was removed/)).toBeVisible();
  }
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download sample/ }).click();
  const download = await pending;
  return (await readFile(await download.path())).toString("base64");
}

test("opt-in pixel path changes local output but never reports SynthID detected or removed", async ({ page }) => {
  const sent: string[] = [];
  page.on("request", request => { if (request.method() === "POST") sent.push(request.url()); });
  const normal = await imageResult(page, false);
  const processed = await imageResult(page, true);
  const changed = await page.evaluate(async ({ normal, processed }) => {
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
    const a = await pixels(normal), b = await pixels(processed);
    return a.length === b.length && a.some((v, i) => v !== b[i]);
  }, { normal, processed });
  expect(changed).toBe(true);
  expect(sent).toEqual([]);
});

test("experimental option does not bypass protection on signed C2PA files", async ({ page }) => {
  await page.goto("/image");
  await page.getByRole("checkbox", { name: "Reprocess image pixels locally (opt-in)" }).check();
  await page.locator('input[type="file"][data-ready="true"]').setInputFiles(fixture("c2pa-sample.jpg"));
  await page.getByRole("button", { name: "Process 1 file" }).click();
  await expect(page.getByText(/Processing paused to protect provenance/)).toBeVisible({ timeout: 45000 });
  await expect(page.getByRole("button", { name: /Download c2pa-sample/ })).toHaveCount(0);
});
