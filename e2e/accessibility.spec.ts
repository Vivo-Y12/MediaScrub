import { expect, test } from "@playwright/test";

test("public content remains visible without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    for (const route of ["/", "/docs", "/privacy"]) {
      await page.goto(route);
      const heading = page.locator("h1");
      await expect(heading).toBeVisible();
      expect(await heading.evaluate(el => getComputedStyle(el.closest("[data-reveal]") ?? el).opacity)).toBe("1");
    }
  } finally {
    await context.close();
  }
});

test("reduced motion keeps content visible and keyboard focus apparent", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  try {
    const page = await context.newPage();
    await page.goto("/image");
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
    expect(await heading.evaluate(el => getComputedStyle(el.closest("[data-reveal]") ?? el).opacity)).toBe("1");
    const quality = page.getByRole("slider", { name: /Quality/i });
    await quality.focus();
    expect(await quality.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe("none");
  } finally {
    await context.close();
  }
});
