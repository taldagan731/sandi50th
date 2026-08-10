import { expect, test } from "@playwright/test";

test("childhood fallback gallery stays hidden on phones", async ({ page }) => {
  await page.goto("/reveal");
  const section = page.locator('section[aria-labelledby="childhood-cylinder-title"]');
  await section.scrollIntoViewIfNeeded();

  const fallback = section.locator('[class*="marqueeReducedGrid"]');
  await expect(fallback).toBeHidden();
  const oversized = await section.locator("img").evaluateAll(images => images.filter(image => {
    const box = image.getBoundingClientRect();
    return box.width > window.innerWidth || box.height > window.innerHeight;
  }).length);
  expect(oversized).toBe(0);
});