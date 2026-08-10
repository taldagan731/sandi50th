import { expect, test } from "@playwright/test";

test("particle credits repeatedly resolve to sharp browser text", async ({ page }) => {
  await page.goto("/contribute", { waitUntil: "domcontentloaded" });
  const footer = page.locator("body > footer.siteCredits");
  await footer.scrollIntoViewIfNeeded();

  await expect(footer).toHaveClass(/isEnhanced/);
  await expect(footer).toHaveClass(/isResolved/, { timeout: 5_000 });
  await page.waitForTimeout(550);

  const resolvedPresentation = await footer.evaluate((element) => {
    const canvas = element.querySelector("canvas") as HTMLCanvasElement;
    const text = element.querySelector(".siteCreditsFallback") as HTMLElement;
    const canvasStyle = getComputedStyle(canvas);
    const textStyle = getComputedStyle(text);
    return {
      canvasOpacity: Number(canvasStyle.opacity),
      textOpacity: Number(textStyle.opacity),
      fontFamily: textStyle.fontFamily,
      backingRatio: canvas.width / canvas.getBoundingClientRect().width,
    };
  });
  expect(resolvedPresentation.canvasOpacity).toBeLessThan(.05);
  expect(resolvedPresentation.textOpacity).toBeGreaterThan(.95);
  expect(resolvedPresentation.fontFamily).toMatch(/Georgia|Times New Roman/);
  expect(resolvedPresentation.backingRatio).toBeGreaterThanOrEqual(1);

  await page.waitForFunction(() => !document.querySelector("footer.siteCredits")?.classList.contains("isResolved"), null, { timeout: 8_000 });
  await expect(footer).toHaveClass(/isResolved/, { timeout: 5_000 });
});
