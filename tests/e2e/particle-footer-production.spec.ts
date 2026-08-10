import { expect, test } from "@playwright/test";

test("credits render as warm particle text", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const footer = page.locator("body > footer.siteCredits");
  await footer.scrollIntoViewIfNeeded();
  await expect(footer).toHaveClass(/isEnhanced/);
  await expect(footer).toContainText("Developed by Tal Dagan");
  await expect(footer).toContainText("Co-producers: Jenny Banayan, Beth Baluarte, and Shiry Yoseph");

  const canvas = footer.locator("canvas.siteCreditsCanvas");
  await expect(canvas).toBeVisible();
  const dimensions = await canvas.evaluate((element) => ({
    width: element.width,
    height: element.height,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  expect(dimensions.width).toBeGreaterThan(250);
  expect(dimensions.height).toBeGreaterThan(100);
  expect(dimensions.overflow).toBeLessThanOrEqual(2);
});

test("credits retain a readable reduced-motion fallback", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const footer = page.locator("body > footer.siteCredits");
  await footer.scrollIntoViewIfNeeded();
  await expect(footer.locator("canvas.siteCreditsCanvas")).toBeHidden();
  await expect(footer.locator(".siteCreditsFallback")).toBeVisible();
  await expect(footer).toContainText("Developed by Tal Dagan");
});
