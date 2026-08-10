import { expect, test } from "@playwright/test";

test("Play film strips starts real motion under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/reveal");

  const play = page.getByRole("button", { name: "Play film strips" }).first();
  await expect(play).toBeVisible();
  await play.click();

  const track = page.locator('[class*="marqueeTrack"]').first();
  await expect(track).toBeVisible();
  const state = await track.evaluate(element => {
    const style = getComputedStyle(element);
    return {
      duration: style.animationDuration,
      iterations: style.animationIterationCount,
      state: style.animationPlayState
    };
  });
  expect(state.duration).not.toBe("0.01ms");
  expect(state.iterations).toBe("infinite");
  expect(state.state).toBe("running");
});