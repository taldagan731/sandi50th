import { expect, test } from "@playwright/test";


test("floating music control is fixed, persistent, and remembers the choice", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const control = page.locator(".globalMusicMute");
  await expect(control).toBeVisible();
  await expect(control).toHaveCSS("position", "fixed");
  const box = await control.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual((await page.viewportSize())!.height);

  await control.click();
  await expect(page.getByRole("button", { name: "Turn birthday music on" })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/contribute", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Turn birthday music on" })).toHaveAttribute("aria-pressed", "true");
});

test("floating control mutes only the birthday music and clears reveal controls", async ({ page }) => {
  await page.goto("/reveal", { waitUntil: "domcontentloaded" });
  const control = page.locator(".globalMusicMute");
  await control.click();
  await expect(page.getByRole("button", { name: "Turn birthday music on" })).toHaveAttribute("aria-pressed", "true");

  const song = page.locator(".musicInvitation + audio");
  await expect(song).toHaveCount(1);
  await expect.poll(() => song.evaluate(node => (node as HTMLAudioElement).volume)).toBe(0);

  const fixedSelectors = [".soundtrackDock", ".chapterNavigator", ".revealContributeCta"];
  const controlBox = await control.boundingBox();
  expect(controlBox).not.toBeNull();
  for (const selector of fixedSelectors) {
    const item = page.locator(selector).first();
    if (!(await item.isVisible().catch(() => false))) continue;
    const itemBox = await item.boundingBox();
    if (!itemBox) continue;
    const overlaps = controlBox!.x < itemBox.x + itemBox.width && controlBox!.x + controlBox!.width > itemBox.x && controlBox!.y < itemBox.y + itemBox.height && controlBox!.y + controlBox!.height > itemBox.y;
    expect(overlaps, `mute control overlaps ${selector}`).toBe(false);
  }

  await page.getByRole("button", { name: "Turn birthday music on" }).click();
  await expect.poll(() => song.evaluate(node => (node as HTMLAudioElement).volume), { timeout: 3000 }).toBeGreaterThan(.3);
});