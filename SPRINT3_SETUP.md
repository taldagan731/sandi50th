# Sprint 3: Secure Upload Setup

Do not invite contributors until every item below is complete and a test upload succeeds.

## GitHub files
Upload this package at repository root, preserving its folders. Replace the existing `components/MemoryContributionForm.tsx`, `supabase/schema.sql`, and `.env.example`.

## Supabase
1. Create a Supabase project named `sandi50th`.
2. Open SQL Editor, paste the full contents of `supabase/schema.sql`, and click Run.
3. In Project Settings, copy the Project URL, anon/publishable key, and service-role/secret key.

## Vercel environment variables
In Vercel → sandi50th → Settings → Environment Variables, add:
- `NEXT_PUBLIC_SITE_URL` = `https://sandi50th.com`
- `NEXT_PUBLIC_SUPABASE_URL` = your Supabase Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon/publishable key
- `SUPABASE_SERVICE_ROLE_KEY` = your Supabase service-role/secret key

Apply each to Production, Preview, and Development. Never place the service-role key in GitHub and never prefix it with `NEXT_PUBLIC_`.

## Redeploy and test
Redeploy the latest Vercel deployment after adding variables. Visit `/contribute` and submit one small test image. Confirm:
- The success screen appears.
- Supabase Table Editor shows one row in `submissions` and one in `media_assets`.
- Supabase Storage → `sandi-memories` contains the uploaded file.
- Opening the raw storage path publicly does not work.
