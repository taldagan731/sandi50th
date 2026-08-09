import { expect, test } from "@playwright/test";

test("Tap to speak uploads Safari M4A and completes the contribution", async ({ page }, testInfo) => {
  const network: Array<{ method: string; url: string; status?: number; postData?: string | null }> = [];
  const consoleErrors: string[] = [];
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("request", request => {
    if (/\/api\/(submissions|uploads)/.test(request.url())) {
      network.push({ method: request.method(), url: request.url(), postData: request.postData() });
    }
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
      state = "inactive";
      mimeType = "audio/mp4;codecs=mp4a.40.2";
      ondataavailable: ((event: Event & { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      start() { this.state = "recording"; }
      stop() {
        if (this.state !== "recording") return;
        this.state = "inactive";
        const bytes = new Uint8Array(512 * 1024);
        for (let index = 0; index < bytes.length; index += 4096) bytes[index] = index % 251;
        const event = new Event("dataavailable") as Event & { data: Blob };
        Object.defineProperty(event, "data", { value: new Blob([bytes], { type: this.mimeType }) });
        this.ondataavailable?.(event);
        this.onstop?.();
      }
    }
    Object.defineProperty(window, "MediaRecorder", { configurable: true, value: FakeRecorder });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) }
    });
    Object.defineProperty(window, "SpeechRecognition", { configurable: true, value: undefined });
    Object.defineProperty(window, "webkitSpeechRecognition", { configurable: true, value: undefined });
  });

  await page.goto("/contribute", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Speak", exact: true }).click();
  const microphone = page.locator("button.memoryMic");
  await expect(microphone).toContainText("Tap to speak instead of typing");
  await microphone.click();
  await expect(microphone).toContainText("Stop and attach my recording");
  await page.waitForTimeout(250);
  await microphone.click();

  await expect(page.getByText(/spoken-memory-.*\.m4a/)).toBeVisible();
  await expect(page.getByText("Your original voice recording is attached")).toBeVisible();
  await page.locator('input[name="name"]').fill("CODEX TAP TO SPEAK TEST");
  await page.locator('input[name="contact"]').fill("excluded-test@sandi50th.com");
  await page.locator('input[name="consent"]').check();
  await page.getByRole("button", { name: "Send everything securely" }).click();

  await expect(page.getByText("YOUR MEMORY ARRIVED")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/Confirmation:/)).toBeVisible();
  await testInfo.attach("tap-to-speak-network", {
    body: Buffer.from(JSON.stringify({ network, consoleErrors }, null, 2)),
    contentType: "application/json"
  });
  expect(network.some(entry => entry.url.endsWith("/api/submissions") && entry.status === 200)).toBeTruthy();
  expect(network.some(entry => entry.url.includes("/api/uploads") && entry.status === 200)).toBeTruthy();
  expect(network.some(entry => entry.url.endsWith("/api/submissions/complete") && entry.status === 200)).toBeTruthy();
  expect(consoleErrors).toEqual([]);
});

