# August 11 owner runbook

## What is already automatic

- Contributions are saved to Supabase as the text and metadata record.
- Media uploads go directly to a private Vercel Blob store.
- Completion creates a second private Blob copy plus a manifest under the submission backup path.
- The public site is noindexed at the page, header, and robots.txt levels.
- Nothing enters the reveal until an owner marks it **Included**.
- AI story output is a draft only. Each chapter must be explicitly approved.

## One-time owner setup

1. Run `supabase/studio-migration.sql` in the Supabase SQL editor.
2. In Supabase Authentication, create the owner user with your email and a strong password.
3. Copy that user's UUID.
4. In the SQL editor, run:

   ```sql
   insert into public.project_members (project_id, user_id, role)
   select id, '<OWNER_USER_UUID>'::uuid, 'owner'
   from public.projects
   where slug = 'sandi50th'
   on conflict (project_id, user_id) do update set role = excluded.role;
   ```

5. Add `ANTHROPIC_API_KEY` to Vercel Production and Preview. Optional: set `ANTHROPIC_MODEL`; otherwise the pinned application default is used.
6. Redeploy the private-studio branch and sign in at `/studio`.

## Daily workflow through August 10

1. Open **Story Studio**.
2. Review every pending contribution.
3. For each media item: choose Included, Excluded, or Pending; assign a chapter; add the caption and any factual note.
4. For videos, seek to the intended still and create its poster frame.
5. Download the private archive index after each review session and retain it outside the website account.
6. Draft all chapters only after the day's review is complete.
7. Correct facts and voice; save drafts.
8. Approve a chapter only when every sentence has been checked.

## August 10 final check

- No pending item is unintentionally omitted.
- Every included video has a poster frame.
- All eight chapters are approved or intentionally left out.
- The reveal works on the actual display and network planned for August 11.
- Download a fresh archive index.
- Keep a local copy of every original media file. The application backup is in the same Vercel account and is not a substitute for an independent offline copy.

## Reveal target

Primary target: a 16:9 laptop or television display, with responsive support for phones. Use current Chrome or Safari, full screen, with the device plugged in and notifications silenced. Reduced-motion mode remains fully usable.
