import { expect, test } from "@playwright/test";

async function choosePath(page: import("@playwright/test").Page, label: string) {
  await page.goto("/contribute", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: new RegExp(label) }).click();
  await expect(page.getByText("Step 1 of 3")).toBeVisible();
  const name = page.getByPlaceholder("Your name");
  await expect(page.getByText("We need your name so Sandi knows who this is from.")).toBeVisible();
  await name.fill("CODEX SIMPLE FLOW TEST");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Step 2 of 3")).toBeVisible();
}

test("first screen is only four choices and fits a small phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/contribute", { waitUntil: "domcontentloaded" });
  for (const label of ["Share a memory", "Send photos", "Record your voice", "Record a birthday video"]) {
    await expect(page.getByRole("button", { name: new RegExp(label) })).toBeVisible();
  }
  await expect(page.locator("input, textarea, select")).toHaveCount(0);
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth, bottom: document.querySelector('.simpleChoiceGrid')?.getBoundingClientRect().bottom ?? 9999, height: innerHeight }));
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.bottom).toBeLessThanOrEqual(dimensions.height);
});

test("memory path asks for name, memory, then permission", async ({ page }) => {
  await choosePath(page, "Share a memory");
  await page.locator("#simple-memory").fill("Sandi always made everyone feel welcome.");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Step 3 of 3")).toBeVisible();
  await expect(page.getByText("Email or phone")).toContainText("Optional");
  const send = page.getByRole("button", { name: "Send to Sandi" });
  await expect(send).toBeDisabled();
  await page.locator('input[type="checkbox"]').check();
  await expect(send).toBeEnabled();
});

test("photo path accepts several photos without writing", async ({ page }) => {
  await choosePath(page, "Send photos");
  await page.locator('input[type="file"]').setInputFiles([
    { name: "one.jpg", mimeType: "image/jpeg", buffer: Buffer.from([0xff,0xd8,0xff,0xd9]) },
    { name: "two.jpg", mimeType: "image/jpeg", buffer: Buffer.from([0xff,0xd8,0xff,0xd9]) }
  ]);
  await expect(page.getByText("2 photos ready")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Step 3 of 3")).toBeVisible();
});

test("voice path creates a Safari M4A and reaches send", async ({ page }) => {
  await page.addInitScript(() => {
    class FakeRecorder {
      static isTypeSupported(type: string) { return type === "audio/mp4"; }
      state = "inactive"; mimeType = "audio/mp4;codecs=mp4a.40.2";
      ondataavailable: ((event: Event & { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      start() { this.state = "recording"; }
      requestData() {}
      stop() { this.state = "inactive"; const event = new Event("dataavailable") as Event & { data: Blob }; Object.defineProperty(event, "data", { value: new Blob([new Uint8Array(4096)], { type: this.mimeType }) }); this.ondataavailable?.(event); this.onstop?.(); }
    }
    Object.defineProperty(window, "MediaRecorder", { configurable: true, value: FakeRecorder });
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) } });
  });
  await choosePath(page, "Record your voice");
  await page.getByRole("button", { name: "Record voice now" }).click();
  await page.getByRole("button", { name: "Stop recording" }).click();
  await expect(page.locator("audio.recordingPlayback")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Step 3 of 3")).toBeVisible();
});

test("birthday path accepts a phone-camera video and reaches send", async ({ page }) => {
  await choosePath(page, "Record a birthday video");
  await page.getByLabel("Choose an existing video").setInputFiles({ name: "birthday.mp4", mimeType: "video/mp4", buffer: Buffer.alloc(8192) });
  await expect(page.locator("video.recordingPlayback")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Step 3 of 3")).toBeVisible();
});
