-- Run once in Supabase SQL Editor after photo-intelligence-migration.sql.
-- Duplicate detection is post-storage, fail-open, and never deletes an original.

alter table public.submissions
  add column if not exists duplicate_review_token_hash text;

alter table public.media_assets
  add column if not exists sha256 text,
  add column if not exists dhash text,
  add column if not exists dhash_band_0 integer,
  add column if not exists dhash_band_1 integer,
  add column if not exists dhash_band_2 integer,
  add column if not exists dhash_band_3 integer,
  add column if not exists image_width integer,
  add column if not exists image_height integer,
  add column if not exists hash_status text not null default 'unprocessed'
    check (hash_status in ('unprocessed', 'queued', 'processing', 'completed', 'failed', 'skipped')),
  add column if not exists hash_error text,
  add column if not exists canonical_media_id uuid references public.media_assets(id) on delete set null,
  add column if not exists contributor_duplicate_action text not null default 'keep'
    check (contributor_duplicate_action in ('keep', 'exclude'));

create index if not exists media_assets_sha256_idx on public.media_assets (sha256) where sha256 is not null;
create index if not exists media_assets_dhash_band_0_idx on public.media_assets (dhash_band_0) where dhash_band_0 is not null;
create index if not exists media_assets_dhash_band_1_idx on public.media_assets (dhash_band_1) where dhash_band_1 is not null;
create index if not exists media_assets_dhash_band_2_idx on public.media_assets (dhash_band_2) where dhash_band_2 is not null;
create index if not exists media_assets_dhash_band_3_idx on public.media_assets (dhash_band_3) where dhash_band_3 is not null;
create index if not exists media_assets_canonical_idx on public.media_assets (canonical_media_id) where canonical_media_id is not null;

create table if not exists public.media_hash_jobs (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  media_asset_id uuid not null unique references public.media_assets(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed', 'skipped')),
  attempts integer not null default 0,
  last_error text,
  locked_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists media_hash_jobs_ready_idx
  on public.media_hash_jobs (status, next_attempt_at, created_at);

create table if not exists public.media_duplicate_matches (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_media_id uuid not null references public.media_assets(id) on delete cascade,
  candidate_media_id uuid not null references public.media_assets(id) on delete cascade,
  match_kind text not null check (match_kind in ('exact', 'near')),
  hamming_distance smallint check (hamming_distance between 0 and 64),
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  contributor_visible boolean not null default false,
  contributor_action text not null default 'unreviewed'
    check (contributor_action in ('unreviewed', 'keep', 'exclude')),
  studio_status text not null default 'open'
    check (studio_status in ('open', 'merged', 'different')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (source_media_id, candidate_media_id),
  check (source_media_id <> candidate_media_id)
);

create index if not exists media_duplicate_matches_open_idx
  on public.media_duplicate_matches (project_id, studio_status, confidence desc);
create index if not exists media_duplicate_matches_source_idx
  on public.media_duplicate_matches (source_media_id, contributor_visible, studio_status);

alter table public.media_hash_jobs enable row level security;
alter table public.media_duplicate_matches enable row level security;
grant all on public.media_hash_jobs to service_role;
grant all on public.media_duplicate_matches to service_role;
grant select, update on public.media_duplicate_matches to authenticated;

drop policy if exists "owner reads duplicate matches" on public.media_duplicate_matches;
create policy "owner reads duplicate matches"
on public.media_duplicate_matches for select to authenticated
using (public.is_project_owner(project_id));

drop policy if exists "owner resolves duplicate matches" on public.media_duplicate_matches;
create policy "owner resolves duplicate matches"
on public.media_duplicate_matches for update to authenticated
using (public.is_project_owner(project_id))
with check (public.is_project_owner(project_id));

create or replace function public.claim_media_hash_jobs(
  requested_limit integer default 4,
  requested_project uuid default null,
  requested_submission uuid default null
)
returns setof public.media_hash_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select jobs.id
    from public.media_hash_jobs jobs
    join public.media_assets media on media.id = jobs.media_asset_id
    where jobs.status in ('queued', 'failed')
      and jobs.next_attempt_at <= now()
      and (requested_project is null or jobs.project_id = requested_project)
      and (requested_submission is null or media.submission_id = requested_submission)
    order by jobs.created_at
    for update skip locked
    limit greatest(1, least(requested_limit, 20))
  )
  update public.media_hash_jobs jobs
  set status = 'processing',
      attempts = jobs.attempts + 1,
      locked_at = now(),
      updated_at = now()
  from candidates
  where jobs.id = candidates.id
  returning jobs.*;
end;
$$;

revoke all on function public.claim_media_hash_jobs(integer, uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_media_hash_jobs(integer, uuid, uuid) to service_role;

notify pgrst, 'reload schema';
