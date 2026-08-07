-- Run once in Supabase SQL Editor after supabase/schema.sql.
-- Adds the private review and story-studio records. No contributor access is granted.

alter table public.submissions
  add column if not exists review_status text not null default 'pending'
    check (review_status in ('pending', 'included', 'excluded'));

alter table public.media_assets
  add column if not exists review_status text not null default 'pending'
    check (review_status in ('pending', 'included', 'excluded')),
  add column if not exists chapter_number smallint
    check (chapter_number between 1 and 8),
  add column if not exists caption text,
  add column if not exists reviewer_notes text,
  add column if not exists poster_path text,
  add column if not exists display_order integer not null default 0,
  add column if not exists reviewed_at timestamptz;

create table if not exists public.story_chapters (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  chapter_number smallint not null check (chapter_number between 1 and 8),
  title text not null,
  source_notes text not null default '',
  draft_text text not null default '',
  approved_text text not null default '',
  status text not null default 'empty'
    check (status in ('empty', 'draft', 'approved')),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (project_id, chapter_number)
);

create table if not exists public.story_assignments (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  media_asset_id uuid references public.media_assets(id) on delete cascade,
  chapter_number smallint not null check (chapter_number between 1 and 8),
  rationale text not null default '',
  confidence numeric(4,3) check (confidence between 0 and 1),
  status text not null default 'suggested'
    check (status in ('suggested', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique (submission_id, media_asset_id, chapter_number)
);

insert into public.story_chapters (project_id, chapter_number, title)
select p.id, c.chapter_number, c.title
from public.projects p
cross join (values
  (1::smallint, 'Once Upon a Time'),
  (2::smallint, 'Growing Up in Roslyn'),
  (3::smallint, 'Finding Her Voice'),
  (4::smallint, 'Building Something Bigger'),
  (5::smallint, 'The Family She Chose'),
  (6::smallint, 'Around the World'),
  (7::smallint, 'The People Who Love Her'),
  (8::smallint, 'Still Becoming')
) as c(chapter_number, title)
where p.slug = 'sandi50th'
on conflict (project_id, chapter_number) do update set title = excluded.title;

alter table public.story_chapters enable row level security;
alter table public.story_assignments enable row level security;

grant all on public.story_chapters to service_role;
grant all on public.story_assignments to service_role;
grant select, insert, update, delete on public.story_chapters to authenticated;
grant select, insert, update, delete on public.story_assignments to authenticated;

drop policy if exists "owner manages story chapters" on public.story_chapters;
create policy "owner manages story chapters"
on public.story_chapters
for all
to authenticated
using (public.is_project_owner(project_id))
with check (public.is_project_owner(project_id));

drop policy if exists "owner manages story assignments" on public.story_assignments;
create policy "owner manages story assignments"
on public.story_assignments
for all
to authenticated
using (public.is_project_owner(project_id))
with check (public.is_project_owner(project_id));

notify pgrst, 'reload schema';
