# Contribution content policy

Date adopted: August 8, 2026

Family and friends' contributions are stored and shown without filtering based on their language. Profanity, candid phrasing, irreverence, or emotionally direct wording must never cause a contribution to be rejected, hidden, rewritten, or excluded.

The following non-content safeguards remain:

- File type and size checks protect upload reliability and storage safety.
- Records whose contributor name contains `MOBILE TEST` or `CODEX` remain hidden because they are development fixtures, not family submissions.
- The authenticated project owner may explicitly use **Exclude** to hide an item from the reveal. Exclusion never deletes the stored original.
- AI photo analysis and story drafting are derivatives. Failure or refusal in either process must not prevent the original contribution from being stored and visible.

The production build runs `scripts/contribution-content-guard.mjs`. It fails if a bad-word, profanity, or text-moderation gate is introduced into contribution intake; if supplied family answers are hidden by default; if visibility ceases to be test-record-only by default; or if exclusion endpoints lose their authenticated owner requirement.
