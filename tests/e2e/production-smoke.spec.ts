import { expect, test, type Page, type TestInfo } from "@playwright/test";

type Diagnostics = {
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  badResponses: string[];
};

function diagnostics(page: Page): Diagnostics {
  const result: Diagnostics = { consoleErrors: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on("console", message => {
    if (message.type() === "error") result.consoleErrors.push(message.text());
  });
  page.on("pageerror", error => result.pageErrors.push(error.message));
  page.on("requestfailed", request => {
    const failure = request.failure()?.errorText ?? "request failed";
    if (!/ERR_ABORTED|cancelled|canceled/i.test(failure)) result.failedRequests.push(`${failure} ${request.url()}`);
  });
  page.on("response", response => {
    if (response.status() >= 400 && !/favicon\.ico/.test(response.url())) {
      result.badResponses.push(`${response.status()} ${response.url()}`);
    }
  });
  return result;
}

async function attachDiagnostics(testInfo: TestInfo, data: Diagnostics) {
  await testInfo.attach("browser-diagnostics", {
    body: Buffer.from(JSON.stringify(data, null, 2)),
    contentType: "application/json"
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth
  }));
  expect(overflow.documentWidth, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.viewportWidth + 2);
}

async function expectClean(data: Diagnostics) {
  expect(data.pageErrors, "uncaught page errors").toEqual([]);
  expect(data.failedRequests, "failed network requests").toEqual([]);
  expect(data.badResponses, "HTTP error responses").toEqual([]);
  expect(data.consoleErrors, "console errors").toEqual([]);
}

async function openPrivateReveal(page: Page) {
  const response = await page.request.post("/api/studio/reveal-preview-link");
  expect(response.ok(), await response.text()).toBeTruthy();
  const body = await response.json() as { url: string };
  await page.goto(body.url, { waitUntil: "domcontentloaded" });
  await expect(page.locator("main.revealPage")).toBeVisible();
  await expect(page.getByText("This story opens on August 11.")).toHaveCount(0);
}

test("homepage loads, stays responsive, and supplies an autoplay-safe hero", async ({ page }, testInfo) => {
  const report = diagnostics(page);
  const response = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByRole("heading", { name: /Sandi Yadegari/i })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const video = page.locator("video.heroBeachMediaVideo").first();
  await expect(video).toHaveCount(1);
  const state = await video.evaluate((element: HTMLVideoElement) => ({
    muted: element.muted,
    autoplay: element.autoplay,
    loop: element.loop,
    playsInline: element.hasAttribute("playsinline"),
    controls: element.controls,
    poster: element.poster,
    source: element.querySelector("source")?.getAttribute("src") ?? ""
  }));
  expect(state).toMatchObject({ muted: true, autoplay: true, loop: true, playsInline: true, controls: false });
  expect(state.poster).toContain("sandi-hero.jpeg");
  expect(state.source).toContain("sandi-beach-waves.mp4");
  await page.waitForTimeout(2_000);
  const playback = await video.evaluate((element: HTMLVideoElement) => ({ currentTime: element.currentTime, paused: element.paused, readyState: element.readyState }));
  expect(playback.readyState, JSON.stringify(playback)).toBeGreaterThanOrEqual(2);
  expect(playback.currentTime, JSON.stringify(playback)).toBeGreaterThan(0.1);
  await attachDiagnostics(testInfo, report);
  await expectClean(report);
});

test("one-page contribution flow exposes every path and accepts mobile formats", async ({ page }, testInfo) => {
  const report = diagnostics(page);
  const response = await page.goto("/contribute", { waitUntil: "domcontentloaded" });
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("Write if you want to. You can leave this blank")).toBeVisible();
  await expect(page.getByText("Choose photos and videos", { exact: true })).toBeVisible();
  await expect(page.getByText("Record your voice", { exact: true })).toBeVisible();
  await expect(page.getByText("Record a birthday video", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send everything securely" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const picker = page.locator('input[type="file"][multiple][accept*=".heic"]').first();
  await picker.setInputFiles([
    { name: "iphone-photo.heic", mimeType: "image/heic", buffer: Buffer.from("emulated-heic") },
    { name: "iphone-recording.m4a", mimeType: "audio/mp4;codecs=mp4a.40.2", buffer: Buffer.from("emulated-aac") }
  ]);
  await expect(page.getByText("2 items", { exact: true })).toBeVisible();
  await expect(page.getByText("iphone-photo.heic", { exact: true })).toBeVisible();
  await expect(page.getByText("iphone-recording.m4a", { exact: true })).toBeVisible();

  const keyTargets = page.locator(".albumActions .filePicker, .submitMemory, .memoryInputModes button");
  const sizes = await keyTargets.evaluateAll(elements => elements.filter(element => {
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  }).map(element => {
    const box = element.getBoundingClientRect();
    return { text: element.textContent?.trim(), width: box.width, height: box.height };
  }));
  expect(sizes.filter(item => item.height < 44), JSON.stringify(sizes)).toEqual([]);
  await attachDiagnostics(testInfo, report);
  await expectClean(report);
});

test("voice and birthday recording entrances remain visible and usable", async ({ page }, testInfo) => {
  const report = diagnostics(page);
  await page.goto("/contribute", { waitUntil: "domcontentloaded" });
  const voiceCapture = page.locator('label.recordPicker:has-text("Record your voice") input[type="file"]');
  const birthdayCapture = page.locator('label.recordPicker:has-text("Record a birthday video") input[type="file"]');
  await expect(voiceCapture).toHaveAttribute("accept", "audio/*");
  await expect(voiceCapture).toHaveAttribute("capture", "");
  await expect(birthdayCapture).toHaveAttribute("accept", "video/*");
  await expect(birthdayCapture).toHaveAttribute("capture", "user");
  await expect(page.getByText("Record your voice", { exact: true })).toBeVisible();
  await expect(page.getByText("Record a birthday video", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await attachDiagnostics(testInfo, report);
  await expectClean(report);
});

test("private reveal and Studio open without exposing the reveal publicly", async ({ page }, testInfo) => {
  const report = diagnostics(page);
  await openPrivateReveal(page);
  await expect(page.locator("main.revealPage")).toBeVisible();
  await expect(page.locator("video[playsinline], audio").first()).toBeAttached();
  await expectNoHorizontalOverflow(page);

  await page.goto("/studio", { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).not.toContainText(/sign in|password/i);
  await expect(page.locator("main")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await attachDiagnostics(testInfo, report);
  await expectClean(report);
});

test("deep reveal sweep has no broken loaded media or technical warnings", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "Pixel-7-Chromium", "One deep sweep is sufficient; other projects run reveal smoke coverage.");
  const report = diagnostics(page);
  await openPrivateReveal(page);
  await page.evaluate(async () => {
    const delay = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));
    for (let y = 0; y < document.documentElement.scrollHeight; y += Math.max(320, window.innerHeight * 0.75)) {
      window.scrollTo(0, y);
      await delay(80);
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
    await delay(1_000);
  });

  const media = await page.evaluate(() => ({
    images: [...document.images].filter(image => image.complete).map(image => ({ src: image.currentSrc || image.src, width: image.naturalWidth })),
    videos: [...document.querySelectorAll("video")].map(video => ({ src: video.currentSrc || video.querySelector("source")?.getAttribute("src") || "", readyState: video.readyState, error: video.error?.message || "" })),
    audios: [...document.querySelectorAll("audio")].map(audio => ({ src: audio.currentSrc || audio.getAttribute("src") || "", readyState: audio.readyState, error: audio.error?.message || "" })),
    text: document.body.innerText
  }));
  expect(media.images.filter(image => image.src && image.width === 0), "broken loaded images").toEqual([]);
  expect(media.videos.filter(video => video.error), "video decode errors").toEqual([]);
  expect(media.audios.filter(audio => audio.error), "audio decode errors").toEqual([]);
  expect(media.text).not.toMatch(/view it in safari|unsupported format|browser cannot display|technical error/i);
  await attachDiagnostics(testInfo, report);
  await expectClean(report);
});

