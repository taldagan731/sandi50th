-- Run once in Supabase SQL Editor after studio-migration.sql.
-- Adds durable photo-analysis jobs and searchable metadata. Contributors receive no read access.

alter table public.media_assets
  add column if not exists exif_status text not null default 'pending'
    check (exif_status in ('pending', 'completed', 'unavailable', 'failed')),
  add column if not exists exif_captured_at timestamptz,
  add column if not exists exif_latitude double precision,
  add column if not exists exif_longitude double precision,
  add column if not exists analysis_status text not null default 'unprocessed'
    check (analysis_status in ('unprocessed', 'queued', 'processing', 'completed', 'review_required', 'failed', 'skipped')),
  add column if not exists analysis_model text,
  add column if not exists analysis_era text,
  add column if not exists analysis_decade smallint,
  add column if not exists analysis_setting text,
  add column if not exists analysis_people_count smallint,
  add column if not exists analysis_composition text,
  add column if not exists analysis_description text,
  add column if not exists analysis_objects text[] not null default '{}',
  add column if not exists analysis_occasion_markers text[] not null default '{}',
  add column if not exists analysis_event_clues text[] not null default '{}',
  add column if not exists analysis_confidence jsonb not null default '{}'::jsonb,
  add column if not exists analysis_raw jsonb,
  add column if not exists analysis_error text,
  add column if not exists analysis_completed_at timestamptz,
  add column if not exists inferred_year_start smallint,
  add column if not exists inferred_year_end smallint,
  add column if not exists date_inference_source text,
  add column if not exists assignment_confidence numeric(4,3)
    check (assignment_confidence between 0 and 1),
  add column if not exists assignment_rationale text;

create table if not exists public.photo_analysis_jobs (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  media_asset_id uuid not null unique references public.media_assets(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'review_required', 'failed', 'skipped')),
  attempts integer not null default 0,
  pilot_rank smallint,
  last_error text,
  locked_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists photo_analysis_jobs_ready_idx
  on public.photo_analysis_jobs (status, next_attempt_at, created_at);

alter table public.photo_analysis_jobs enable row level security;
grant all on public.photo_analysis_jobs to service_role;
grant select, insert, update, delete on public.photo_analysis_jobs to authenticated;

drop policy if exists "owner manages photo analysis jobs" on public.photo_analysis_jobs;
create policy "owner manages photo analysis jobs"
on public.photo_analysis_jobs
for all
to authenticated
using (public.is_project_owner(project_id))
with check (public.is_project_owner(project_id));

create or replace function public.claim_photo_analysis_jobs(
  requested_limit integer default 1,
  requested_project uuid default null,
  requested_submission uuid default null
)
returns setof public.photo_analysis_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select jobs.id
    from public.photo_analysis_jobs jobs
    join public.media_assets media on media.id = jobs.media_asset_id
    where jobs.status in ('queued', 'failed')
      and jobs.next_attempt_at <= now()
      and (requested_project is null or jobs.project_id = requested_project)
      and (requested_submission is null or media.submission_id = requested_submission)
    order by coalesce(jobs.pilot_rank, 32767), jobs.created_at
    for update skip locked
    limit greatest(1, least(requested_limit, 10))
  )
  update public.photo_analysis_jobs jobs
  set status = 'processing',
      attempts = jobs.attempts + 1,
      locked_at = now(),
      updated_at = now()
  from candidates
  where jobs.id = candidates.id
  returning jobs.*;
end;
$$;

revoke all on function public.claim_photo_analysis_jobs(integer, uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_photo_analysis_jobs(integer, uuid, uuid) to service_role;

notify pgrst, 'reload schema';
