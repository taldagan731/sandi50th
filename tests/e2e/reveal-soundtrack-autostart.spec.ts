import { expect, test } from "@playwright/test";

test("reveal soundtrack starts without a separate Play button when the browser permits it", async ({ page }) => {
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = function () {
      this.dispatchEvent(new Event("play"));
      return Promise.resolve();
    };
  });
  await page.goto("/reveal");
  const invitation = page.locator(".musicInvitation");
  await expect(invitation).toBeVisible();
  await expect(invitation.getByRole("button", { name: /play/i })).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "Reveal audio controls" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
});