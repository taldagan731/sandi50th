import path from "node:path";
import { expect, test } from "@playwright/test";

test("iPhone reveal audio buttons stay separate and compact", async ({ page }) => {
  await page.setContent(`
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <div class="revealExperience">
      <aside class="soundtrackDock" aria-label="Reveal audio controls">
        <button type="button">Pause</button>
        <label><span>Music 50%</span><input aria-label="Birthday song volume" type="range" /></label>
        <label><span>Under voices 12%</span><input aria-label="Music level under voices" type="range" /></label>
        <button type="button">Voices on</button>
        <button class="masterMute" type="button">Mute all</button>
      </aside>
    </div>
  `);
  await page.addStyleTag({ path: path.resolve("app/globals.css") });
  await page.addStyleTag({ path: path.resolve("app/celebration-pass.css") });
  await page.addStyleTag({ path: path.resolve("app/reveal/name-chorus.css") });

  const dock = page.getByRole("complementary", { name: "Reveal audio controls" });
  await expect(dock).toBeVisible();
  const metrics = await dock.evaluate(element => {
    const dockRect = element.getBoundingClientRect();
    const buttons = [...element.querySelectorAll("button")].map(button => {
      const rect = button.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, height: rect.height };
    });
    const overlaps = buttons.flatMap((first, firstIndex) =>
      buttons.slice(firstIndex + 1).filter(second =>
        first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top,
      ),
    ).length;
    return {
      dockHeight: dockRect.height,
      dockLeft: dockRect.left,
      dockRight: dockRect.right,
      viewportWidth: window.innerWidth,
      overlaps,
      buttonHeights: buttons.map(button => button.height),
    };
  });

  expect(metrics.overlaps).toBe(0);
  expect(metrics.dockHeight).toBeLessThanOrEqual(170);
  expect(metrics.dockLeft).toBeGreaterThanOrEqual(0);
  expect(metrics.dockRight).toBeLessThanOrEqual(metrics.viewportWidth);
  expect(metrics.buttonHeights.every(height => height >= 44)).toBe(true);
});
