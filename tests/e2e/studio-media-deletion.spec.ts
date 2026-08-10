import { expect, test } from "@playwright/test";

const mediaId = "11111111-1111-4111-8111-111111111111";
const submissionId = "22222222-2222-4222-8222-222222222222";

test("Studio requires two confirmations and Purple50 before deleting a photo", async ({ page }) => {
  let deleteRequests = 0;
  let deleteBody: Record<string, unknown> | null = null;

  await page.route("**/api/studio/**", async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === "/api/studio/contributions") {
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          intelligenceAvailable: true,
          report: null,
          submissions: [{
            id: submissionId,
            name: "Deletion Test",
            contact: "",
            relationship: "Friend",
            first_memory: "A test memory",
            story: "",
            approximate_year: "",
            location: "",
            people: [],
            life_chapter: "",
            prompt: "MEMORY",
            status: "visible",
            review_status: "included",
            created_at: "2026-08-10T12:00:00.000Z",
            media: [{
              id: mediaId,
              submission_id: submissionId,
              original_name: "sandi-test-photo.jpg",
              mime_type: "image/jpeg",
              bytes: 12345,
              review_status: "included",
              chapter_number: 1,
              caption: "",
              reviewer_notes: "",
              poster_path: null,
              display_order: 0
            }]
          }]
        })
      });
    }
    if (pathname === "/api/studio/reveal-access") {
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ revealPublic: false }) });
    }
    if (pathname === "/api/studio/media-delete") {
      deleteRequests += 1;
      deleteBody = request.postDataJSON();
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, deletedId: mediaId, storageCleanupComplete: true }) });
    }
    const emptyResponses: Record<string, unknown> = {
      "/api/studio/family-qa": { answers: [], choruses: [], pending: [], suppliedCount: 0 },
      "/api/studio/duplicates": { available: true, matches: [], media: [], submissions: [] },
      "/api/studio/photo-orientation": { photos: [] },
      "/api/studio/reveal-share": { active: null, migrationRequired: false },
      "/api/studio/story": { chapters: [] }
    };
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(emptyResponses[pathname] ?? {}) });
  });

  await page.goto("/studio");
  await page.getByText("Organize, search, and edit contributions").click();

  await page.getByRole("button", { name: "Permanently delete photo" }).click();
  expect(deleteRequests).toBe(0);
  await expect(page.getByText("First confirmation:")).toBeVisible();

  await page.getByRole("button", { name: "Continue to final confirmation" }).click();
  expect(deleteRequests).toBe(0);
  const finalDelete = page.getByRole("button", { name: "Delete photo permanently" });
  await expect(finalDelete).toBeDisabled();

  const keyword = page.getByLabel("Final confirmation: type Purple50");
  await keyword.fill("purple50");
  await expect(finalDelete).toBeDisabled();
  await keyword.fill("Purple50");
  await expect(finalDelete).toBeEnabled();
  await finalDelete.click();

  expect(deleteRequests).toBe(1);
  expect(deleteBody).toEqual({
    mediaId,
    firstConfirmation: "I understand this cannot be undone",
    keyword: "Purple50"
  });
});
