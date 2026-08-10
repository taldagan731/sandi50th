import { expect, test } from "@playwright/test";

test("simple voice path uploads Safari M4A and completes the contribution", async ({ page }) => {
  const network: Array<{ method: string; url: string; status?: number }> = [];
  const consoleErrors: string[] = [];
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("request", request => {
    if (/\/api\/(submissions|uploads)/.test(request.url())) network.push({ method: request.method(), url: request.url() });
  });
  page.on("response", response => {
    if (/\/api\/(submissions|uploads)/.test(response.url())) {
      const item = [...network].reverse().find(entry => entry.url === response.url() && entry.status === undefined);
      if (item) item.status = response.status();
    }
  });
  await page.addInitScript(() => {
    class FakeRecorder {
      static isTypeSupported(type: string) { return type === "audio/mp4"; }
      state = "inactive"; mimeType = "audio/mp4;codecs=mp4a.40.2";
      ondataavailable: ((event: Event & { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      start() { this.state = "recording"; }
      requestData() {}
      stop() {
        this.state = "inactive";
        const event = new Event("dataavailable") as Event & { data: Blob };
        Object.defineProperty(event, "data", { value: new Blob([new Uint8Array(512 * 1024)], { type: this.mimeType }) });
        this.ondataavailable?.(event);
        this.onstop?.();
      }
    }
    Object.defineProperty(window, "MediaRecorder", { configurable: true, value: FakeRecorder });
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) } });
  });

  await page.goto("/contribute", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Record your voice/ }).click();
  await page.getByPlaceholder("Your name").fill("CODEX SIMPLE VOICE TEST");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Record voice now" }).click();
  await page.getByRole("button", { name: "Stop recording" }).click();
  await expect(page.locator("audio.recordingPlayback")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: "Send to Sandi" }).click();

  await expect(page.getByText("VOICE MEMORY RECEIVED")).toBeVisible({ timeout: 60_000 });
  expect(network.some(entry => entry.url.endsWith("/api/submissions") && entry.status === 200)).toBeTruthy();
  expect(network.some(entry => entry.url.includes("/api/uploads") && entry.status === 200)).toBeTruthy();
  expect(network.some(entry => entry.url.endsWith("/api/submissions/complete") && entry.status === 200)).toBeTruthy();
  expect(consoleErrors).toEqual([]);
});
