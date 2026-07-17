# Go-Live Checklist — Release 0.4

## What this release includes
- Cinematic public homepage.
- Contributor memory form.
- Secure direct-to-Supabase media uploads.
- Submission metadata and file records.
- Private Story Studio placeholder.

## Required before real submissions
1. Create a Supabase project named `sandi50th`.
2. Run `supabase/schema.sql` in Supabase SQL Editor.
3. Add the four environment variables from `.env.example` in Vercel.
4. Redeploy Vercel.
5. Test with one small image at `/contribute`.
6. Confirm the image appears in Supabase Storage → `sandi-memories`.
7. Confirm a row appears in Table Editor → `submissions`.

Do not invite contributors until the test succeeds.
