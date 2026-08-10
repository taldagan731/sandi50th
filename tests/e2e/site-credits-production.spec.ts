import { expect, test } from "@playwright/test";

for (const path of ["/", "/contribute", "/reveal", "/studio"]) {
  test(`site credits finish ${path}`, async ({ page }) => {
    await page.goto(path, { waitUntil: "domcontentloaded" });

    const credits = page.locator("body > footer.siteCredits");
    await expect(credits).toHaveCount(1);
    await expect(credits).toContainText("Developed by Tal Dagan");
    await expect(credits).toContainText("Co-producers: Jenny Banayan, Beth Baluarte, and Shiry Yoseph");

    const placement = await credits.evaluate((footer) => {
      const rect = footer.getBoundingClientRect();
      return {
        distanceFromPageBottom: Math.abs(document.documentElement.scrollHeight - (rect.bottom + window.scrollY)),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    expect(placement.distanceFromPageBottom).toBeLessThanOrEqual(2);
    expect(placement.overflow).toBeLessThanOrEqual(2);
  });
}
