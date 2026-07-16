# sandi50th.com

Production foundation for **Still Becoming — The Story of Sandi**.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Repository upload
Upload the contents of this folder to the root of the `main` branch. GitHub should show `app`, `components`, `public`, `supabase`, `package.json`, and `README.md` at the top level.

## Next deployment steps
1. Import the GitHub repository into Vercel.
2. Create a Supabase project and run `supabase/schema.sql`.
3. Copy `.env.example` to `.env.local` and add Supabase credentials locally or in Vercel.
4. Add `sandi50th.com` and `www.sandi50th.com` in Vercel Domains.
5. Preserve all IONOS email MX records for `uploads@sandi50th.com`.

Do not commit `.env.local` or passwords.
