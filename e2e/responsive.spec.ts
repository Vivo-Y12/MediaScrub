import { expect, test } from "@playwright/test";
import path from "node:path";

const routes = ["/", "/provenance", "/image", "/video", "/metadata", "/docs", "/privacy"];
const widths = [320, 390, 768, 1024, 1280];

for (const width of widths) {
  test(`navigation and page width at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 860 });
    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator("main")).toBeVisible();
      const { scrollWidth, headerActionRight } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        headerActionRight: Math.ceil(document.querySelector("header button[aria-label^='Switch to']")!.getBoundingClientRect().right),
      }));
      expect(scrollWidth, `${route} has horizontal overflow at ${width}px`).toBeLessThanOrEqual(width + 1);
      expect(headerActionRight, `${route} hides the theme action at ${width}px`).toBeLessThanOrEqual(width);
    }

    await page.goto("/provenance");
    if (width < 1280) {
      const toggle = page.getByRole("button", { name: "Toggle menu" });
      await expect(toggle).toBeVisible();
      await toggle.click();
      await expect(page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: "Video" })).toBeVisible();
      await page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: "Image" }).click();
      await expect(page).toHaveURL(/\/image$/);
      await expect(page.getByRole("navigation", { name: "Mobile" })).toHaveCount(0);
    } else {
      await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Video" })).toBeVisible();
    }
  });
}

test("phone and tablet can process a local image and download it", async ({ page }) => {
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 860 });
    await page.goto("/image");
    await page.locator('input[type="file"][data-ready="true"]').setInputFiles(path.join(__dirname, "fixtures/sample.png"));
    // PNG is a universally supported export here; Firefox's WebP file handler may open a preview instead.
    await page.getByRole("radio", { name: /PNG/ }).check();
    await expect(page.getByRole("radio", { name: /PNG/ })).toBeChecked();
    await page.getByRole("button", { name: "Process 1 file" }).click();
    const downloadButton = page.getByRole("button", { name: /Download sample/ });
    await expect(downloadButton).toBeVisible({ timeout: 45000 });
    const download = page.waitForEvent("download");
    await downloadButton.click();
    expect((await download).suggestedFilename()).toBe("sample.png");
  }
});

test("large image batch is processed without dropping queued files", async ({ page }) => {
  await page.goto("/image");
  const { readFile } = await import("node:fs/promises");
  const buffer = await readFile(path.join(__dirname, "fixtures/sample.png"));
  await page.locator('input[type="file"][data-ready="true"]').setInputFiles(
    Array.from({ length: 8 }, (_, i) => ({ name: `batch-${i}.png`, mimeType: "image/png", buffer }))
  );
  await page.getByRole("button", { name: "Process 8 files" }).click();
  await expect(page.getByText("8/8 done")).toBeVisible({ timeout: 55000 });
  await expect(page.getByRole("button", { name: /Download batch-/ })).toHaveCount(8);
});

test("touch phone and tablet menu, local file picker and provenance inspection", async ({ browser, browserName }) => {
  test.skip(browserName === "firefox", "Firefox desktop does not support Playwright mobile emulation");
  const { devices } = await import("@playwright/test");
  for (const name of ["iPhone 13", "iPad Mini"]) {
    const context = await browser.newContext({ ...devices[name], baseURL: "http://localhost:3000" });
    try {
      const page = await context.newPage();
      await page.goto("/provenance");
      const width = await page.evaluate(() => document.documentElement.clientWidth);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${name} has no horizontal page overflow`).toBeLessThanOrEqual(width + 1);
      const toggle = page.getByRole("button", { name: "Toggle menu" });
      await toggle.tap();
      await expect(page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: "Metadata" })).toBeVisible();
      await toggle.tap();
      await page.locator('input[type="file"][data-ready="true"]').setInputFiles(path.join(__dirname, "fixtures/sample.png"));
      await page.getByRole("button", { name: "Inspect queued" }).tap();
      await expect(page.getByText("No C2PA manifest detected", { exact: true }).first()).toBeVisible({ timeout: 45000 });
    } finally {
      await context.close();
    }
  }
});
