# August 11 Reveal Freeze

**Freeze date:** August 10, 2026  
**Status:** Prepared. Activate after the final owner backup verification and rehearsal.

## Frozen release contract

- The entire site remains `noindex`, `nofollow`, `noarchive`, and blocked by `robots.txt`.
- Contributions remain open through August 10, 2026.
- Text, single-file, album/folder/ZIP, voice, and birthday-message contribution paths remain available.
- A failed analysis or EXIF read never fails or rolls back a contribution.
- Originals and backup copies remain in private owned storage. Anthropic receives only a reduced, re-encoded, metadata-free derivative.
- Studio and reveal media remain owner-authenticated. Only owner-included media appears in the reveal.
- Video playback remains inline and user-initiated.
- Chapter Nine remains an invitation only. Authoring is deferred until after August 11.
- Every production smoke test must wait for the exact Git commit served by Vercel before uploading its test memory.

## Changes permitted after freeze

Only defects that could lose a contribution, expose private material, block owner access, prevent reveal playback, or break the production deployment. Each fix receives its own build, deployment, and production smoke result. No new feature work joins the reveal release.

## Owner rehearsal checklist

1. Run **Verify all backups** in `/studio`; require zero failures.
2. Download the archive index and retain a local copy.
3. Review every item marked **Included**, especially videos and birthday messages.
4. Confirm each included video has a deliberate poster frame and plays inline.
5. Read and approve all eight chapter drafts.
6. Run the reveal from beginning to end on the screen and network intended for August 11.
7. Keep a signed-in Studio tab and the downloaded archive index available during the reveal.

The build-time `scripts/release-freeze-check.mjs` guard enforces the stable parts of this contract on every production build.
