import { expect, test } from "@playwright/test";

test("Tal dedication is complete, separate, and responsive", async ({ page }) => {
  const previewResponse = await page.request.post("/api/studio/reveal-preview-link");
  expect(previewResponse.ok(), await previewResponse.text()).toBeTruthy();
  const { url } = await previewResponse.json() as { url: string };
  await page.goto(url, { waitUntil: "domcontentloaded" });

  const dedication = page.locator(".talDedication");
  await expect(dedication).toBeAttached();
  await expect(dedication.getByRole("heading", { name: "For Sandi." })).toBeVisible();
  await expect(dedication).toContainText("I have known you for eight years, 16 percent of your life.");
  await expect(dedication).toContainText("You are my Venus, definitely my not-lobster.");
  await expect(dedication).toContainText("Happy 50th birthday, my darling, my better half.");
  await expect(dedication).toContainText("Tal");

  const image = dedication.getByRole("img");
  await expect(image).toHaveAttribute("alt", /Apatura iris/);
  await expect(image).toHaveAttribute("width", "2400");

  const structure = await page.evaluate(() => {
    const finale = document.querySelector('[aria-label^="What the Family Knows"]');
    const dedication = document.querySelector(".talDedication");
    const birthday = document.querySelector(".birthdayReel");
    return {
      finaleBeforeDedication: Boolean(finale && dedication && finale.compareDocumentPosition(dedication) & Node.DOCUMENT_POSITION_FOLLOWING),
      dedicationBeforeBirthday: Boolean(dedication && birthday && dedication.compareDocumentPosition(birthday) & Node.DOCUMENT_POSITION_FOLLOWING),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      columns: dedication ? getComputedStyle(dedication).gridTemplateColumns.split(" ").length : 0
    };
  });
  expect(structure.finaleBeforeDedication).toBeTruthy();
  expect(structure.dedicationBeforeBirthday).toBeTruthy();
  expect(structure.overflow).toBeLessThanOrEqual(2);
  if ((page.viewportSize()?.width ?? 1000) <= 780) expect(structure.columns).toBe(1);
  else expect(structure.columns).toBe(2);
});
